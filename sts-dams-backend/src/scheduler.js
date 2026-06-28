const cron = require('node-cron');
const { getPool, sql } = require('./config/db');
const logger = require('./config/logger');

const SCHEDULES = {
  DAILY_KPI: '5 0 * * *',        // 每日 00:05 UTC (北京时间 08:05)
  DAILY_LTV: '30 0 * * *',       // 每日 00:30 UTC (北京时间 08:30)
  INVENTORY_CHECK: '*/30 * * * *', // 每 30 分钟
  WARM_ARCHIVE: '0 2 * * *',     // 每日 02:00 UTC
  COLD_ARCHIVE: '0 3 1 * *',     // 每月 1 日 03:00 UTC
  COUPON_EXPIRE: '5 0 * * *',    // 每日 00:05 UTC 标记过期优惠券
  NOTIFICATION_CLEANUP: '0 3 * * *', // 每日 03:00 UTC 清理 90 天前已读通知
};

async function generateDailyKpiSnapshot() {
  try {
    const pool = await getPool();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);

    // 检查是否已生成
    const existing = await pool.request()
      .input('date', sql.Date, dateStr)
      .query('SELECT COUNT(*) AS cnt FROM Daily_KPI_Snapshot WHERE Snapshot_Date = @date');
    if (existing.recordset[0].cnt > 0) {
      logger.debug(`KPI 快照 ${dateStr} 已存在，跳过`);
      return;
    }

    // 聚合数据
    const result = await pool.request()
      .input('date', sql.Date, dateStr)
      .query(`
        INSERT INTO Daily_KPI_Snapshot
          (Snapshot_Date, Total_Sessions, Completed_Sessions, Aborted_Sessions,
           Total_Revenue_Script, Total_Revenue_Consumption, Total_Refund,
           Active_Players, New_Registrations)
        SELECT
          @date AS Snapshot_Date,
          COUNT(DISTINCT s.Session_ID) AS Total_Sessions,
          COUNT(DISTINCT CASE WHEN s.Session_Status = 'Completed' THEN s.Session_ID END) AS Completed_Sessions,
          COUNT(DISTINCT CASE WHEN s.Session_Status = 'Aborted' THEN s.Session_ID END) AS Aborted_Sessions,
          ISNULL(SUM(CASE WHEN pt.Transaction_Type IN ('Deposit','Final_Payment')
              THEN pt.Amount ELSE 0 END), 0) AS Total_Revenue_Script,
          ISNULL((SELECT SUM(fsc.Line_Total_Cost)
            FROM Fact_Session_Consumption fsc
            WHERE CAST(fsc.Recorded_At AS DATE) = @date), 0) AS Total_Revenue_Consumption,
          ISNULL(SUM(CASE WHEN pt.Transaction_Type = 'Refund'
              THEN ABS(pt.Amount) ELSE 0 END), 0) AS Total_Refund,
          COUNT(DISTINCT bpr.Player_User_ID) AS Active_Players,
          COUNT(DISTINCT CASE WHEN CAST(a.Account_Created_At AS DATE) = @date
              THEN a.User_ID END) AS New_Registrations
        FROM Fact_Session_Schedule s
        LEFT JOIN Bridge_Player_Registration bpr ON bpr.Session_ID = s.Session_ID
        LEFT JOIN Payment_Transaction_Table pt ON pt.Registration_ID = bpr.Registration_ID
          AND CAST(pt.Processed_At AS DATE) = @date
        CROSS JOIN (SELECT 1 AS dummy) dummy
        LEFT JOIN Account_Base_Table a ON 1=1
        WHERE CAST(s.Scheduled_Start_Time AS DATE) = @date
      `);

    logger.info(`KPI 快照 ${dateStr} 生成成功`);
  } catch (err) {
    logger.error('KPI 快照生成失败', { error: err.message });
  }
}

async function generateUserLtvSnapshot() {
  try {
    const pool = await getPool();
    const today = new Date().toISOString().slice(0, 10);

    const existing = await pool.request()
      .input('date', sql.Date, today)
      .query('SELECT COUNT(*) AS cnt FROM Daily_User_LTV_Snapshot WHERE Snapshot_Date = @date');
    if (existing.recordset[0].cnt > 0) {
      logger.debug(`LTV 快照 ${today} 已存在，跳过`);
      return;
    }

    await pool.request()
      .input('date', sql.Date, today)
      .query(`
        INSERT INTO Daily_User_LTV_Snapshot
          (User_ID, Snapshot_Date, Lifetime_Days, Total_Sessions_Attended,
           Total_Spent_Script, Total_Spent_Consumption, Avg_Per_Session_Spend,
           Days_Since_Last_Session)
        SELECT
          a.User_ID,
          @date AS Snapshot_Date,
          DATEDIFF(DAY, a.Account_Created_At, @date) AS Lifetime_Days,
          COUNT(DISTINCT bpr.Session_ID) AS Total_Sessions_Attended,
          ISNULL(SUM(CASE WHEN pt.Transaction_Type IN ('Deposit','Final_Payment')
              THEN pt.Amount ELSE 0 END), 0) AS Total_Spent_Script,
          ISNULL(cons.Total_Consumption, 0) AS Total_Spent_Consumption,
          CASE WHEN COUNT(DISTINCT bpr.Session_ID) > 0
            THEN (ISNULL(SUM(CASE WHEN pt.Transaction_Type IN ('Deposit','Final_Payment')
              THEN pt.Amount ELSE 0 END), 0) + ISNULL(cons.Total_Consumption, 0))
              / COUNT(DISTINCT bpr.Session_ID)
            ELSE 0
          END AS Avg_Per_Session_Spend,
          DATEDIFF(DAY, ISNULL(last_play.Last_Session_Date, a.Account_Created_At), @date) AS Days_Since_Last_Session
        FROM Account_Base_Table a
        LEFT JOIN Bridge_Player_Registration bpr ON bpr.Player_User_ID = a.User_ID
        LEFT JOIN Payment_Transaction_Table pt ON pt.Registration_ID = bpr.Registration_ID
        CROSS APPLY (
          SELECT ISNULL(SUM(fsc.Line_Total_Cost), 0) AS Total_Consumption
          FROM Bridge_Player_Registration br2
          JOIN Fact_Session_Consumption fsc ON fsc.Session_ID = br2.Session_ID
          WHERE br2.Player_User_ID = a.User_ID
        ) cons
        CROSS APPLY (
          SELECT MAX(CAST(s.Scheduled_Start_Time AS DATE)) AS Last_Session_Date
          FROM Bridge_Player_Registration br3
          JOIN Fact_Session_Schedule s ON s.Session_ID = br3.Session_ID
          WHERE br3.Player_User_ID = a.User_ID
            AND s.Session_Status = 'Completed'
        ) last_play
        WHERE a.Role_Type = 1 AND a.Is_Deleted = 0
        GROUP BY a.User_ID, a.Account_Created_At, cons.Total_Consumption, last_play.Last_Session_Date
      `);

    logger.info(`LTV 快照 ${today} 生成成功`);
  } catch (err) {
    logger.error('LTV 快照生成失败', { error: err.message });
  }
}

async function checkInventoryAlerts() {
  try {
    const pool = await getPool();
    const alerts = await pool.request().query(`
      SELECT Item_ID, Item_Name, Current_Stock_Cache, Safety_Alert_Threshold
      FROM Dim_Inventory_Item
      WHERE Current_Stock_Cache < Safety_Alert_Threshold
        AND Is_Delisted = 0
      ORDER BY Current_Stock_Cache ASC
    `);

    if (alerts.recordset.length > 0) {
      logger.warn(`库存预警: ${alerts.recordset.length} 种商品低于安全线`, {
        items: alerts.recordset.map(item => ({
          name: item.Item_Name,
          stock: item.Current_Stock_Cache,
          threshold: item.Safety_Alert_Threshold,
        })),
      });
    }
  } catch (err) {
    logger.error('库存预警检查失败', { error: err.message });
  }
}

async function warmArchive() {
  try {
    const pool = await getPool();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const cutoff = sixMonthsAgo.toISOString().slice(0, 10);

    const toArchive = await pool.request()
      .input('cutoff', sql.Date, cutoff)
      .query(`
        SELECT Session_ID FROM Fact_Session_Schedule
        WHERE Session_Status IN ('Completed', 'Aborted')
          AND CAST(Scheduled_Start_Time AS DATE) < @cutoff
      `);

    if (toArchive.recordset.length > 0) {
      // 每条 INSERT + DELETE 使用事务包裹，防止中途失败导致数据不一致
      let archivedCount = 0;
      for (const row of toArchive.recordset) {
        const tx = new sql.Transaction(pool);
        try {
          await tx.begin();
          await tx.request()
            .input('id', sql.BigInt, row.Session_ID)
            .query(`
              INSERT INTO Fact_Session_Schedule_Archive
              SELECT * FROM Fact_Session_Schedule WHERE Session_ID = @id
            `);
          await tx.request()
            .input('id', sql.BigInt, row.Session_ID)
            .query(`DELETE FROM Fact_Session_Schedule WHERE Session_ID = @id`);
          await tx.commit();
          archivedCount++;
        } catch (err) {
          await tx.rollback();
          logger.error(`归档场次 ${row.Session_ID} 失败`, { error: err.message });
        }
      }
      logger.info(`温归档完成`, { archivedCount, total: toArchive.recordset.length, cutoff });
    } else {
      logger.debug(`温归档: 无待归档场次 (截止 ${cutoff})`);
    }
  } catch (err) {
    logger.error('温归档失败', { error: err.message });
  }
}

async function coldArchive() {
  // 冷归档: 将 2 年前归档表数据导出为 JSON 文件后清理
  // 实际生产环境应导出 Parquet/CSV 到 OSS/S3
  logger.warn('冷归档检查完成 (当前为演示模式，需配置 OSS/S3 后启用实际导出)');
}

async function expireCoupons() {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`UPDATE User_Coupon_Instance SET Coupon_Status = 'Expired'
              WHERE Coupon_Status = 'Unused' AND Expires_At < SYSUTCDATETIME()`);
    if (result.rowsAffected[0] > 0) {
      logger.info(`优惠券过期标记: ${result.rowsAffected[0]} 张`);
    }
  } catch (err) {
    logger.error('优惠券过期标记失败', { error: err.message });
  }
}

async function cleanupNotifications() {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('cutoff', sql.DateTime2, new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))
      .query(`DELETE FROM User_Notification
              WHERE Is_Read = 1 AND Read_At < @cutoff`);
    if (result.rowsAffected[0] > 0) {
      logger.info(`通知清理: ${result.rowsAffected[0]} 条已读通知已删除`);
    }
  } catch (err) {
    logger.error('通知清理失败', { error: err.message });
  }
}

/** 启动延迟（毫秒），确保数据库连接就绪 */
const STARTUP_DELAY_MS = 5000;

function startScheduler() {
  logger.info('定时任务调度器启动');

  cron.schedule(SCHEDULES.DAILY_KPI, generateDailyKpiSnapshot);
  cron.schedule(SCHEDULES.DAILY_LTV, generateUserLtvSnapshot);
  cron.schedule(SCHEDULES.INVENTORY_CHECK, checkInventoryAlerts);
  cron.schedule(SCHEDULES.WARM_ARCHIVE, warmArchive);
  cron.schedule(SCHEDULES.COLD_ARCHIVE, coldArchive);
  cron.schedule(SCHEDULES.COUPON_EXPIRE, expireCoupons);
  cron.schedule(SCHEDULES.NOTIFICATION_CLEANUP, cleanupNotifications);

  logger.info('已注册 7 个定时任务', {
    tasks: [
      `KPI 快照: ${SCHEDULES.DAILY_KPI}`,
      `LTV 快照: ${SCHEDULES.DAILY_LTV}`,
      `库存预警: ${SCHEDULES.INVENTORY_CHECK}`,
      `温归档: ${SCHEDULES.WARM_ARCHIVE}`,
      `冷归档: ${SCHEDULES.COLD_ARCHIVE}`,
      `优惠券过期: ${SCHEDULES.COUPON_EXPIRE}`,
      `通知清理: ${SCHEDULES.NOTIFICATION_CLEANUP}`,
    ],
  });

  // 启动时立即执行一次快照生成（如果当天数据缺失）
  setTimeout(() => {
    logger.info('启动初始化：检查并补全今日快照数据...');
    generateDailyKpiSnapshot();
    generateUserLtvSnapshot();
    checkInventoryAlerts();
    expireCoupons();
  }, STARTUP_DELAY_MS);
}

module.exports = { startScheduler };

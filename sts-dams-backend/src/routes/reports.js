const { Router } = require('express');
const { getPool, sql } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const router = Router();
router.use(authenticate);
router.use(authorize(3)); // 全部报表仅 Admin

// GET /api/reports/daily-kpi?from=2026-05-01&to=2026-05-26
router.get('/daily-kpi', async (req, res) => {
  try {
    const pool = await getPool();
    const { from, to } = req.query;
    let query = 'SELECT * FROM Daily_KPI_Snapshot WHERE 1=1';
    const request = pool.request();
    if (from) {
      query += ' AND Snapshot_Date >= @from';
      request.input('from', sql.NVarChar, from);
    }
    if (to) {
      query += ' AND Snapshot_Date <= @to';
      request.input('to', sql.NVarChar, to);
    }
    query += ' ORDER BY Snapshot_Date DESC';

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('KPI error:', err);
    res.status(500).json({ error: '获取 KPI 数据失败' });
  }
});

// GET /api/reports/player-ltv?user_id=5
router.get('/player-ltv', async (req, res) => {
  try {
    const pool = await getPool();
    const { user_id } = req.query;
    let query = 'SELECT * FROM Daily_User_LTV_Snapshot WHERE 1=1';
    const request = pool.request();
    if (user_id) {
      query += ' AND User_ID = @userId';
      request.input('userId', sql.Int, parseInt(user_id));
    }
    query += ' ORDER BY Snapshot_Date DESC';

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('LTV error:', err);
    res.status(500).json({ error: '获取 LTV 数据失败' });
  }
});

// GET /api/reports/social-topology
router.get('/social-topology', async (req, res) => {
  try {
    const pool = await getPool();
    const { min_co_play = 1 } = req.query;
    const result = await pool.request()
      .input('min', sql.Int, parseInt(min_co_play))
      .query(`SELECT v.*, a1.Account_Name AS Player_A_Name, a2.Account_Name AS Player_B_Name
              FROM vw_Player_Social_Edges v
              JOIN Account_Base_Table a1 ON a1.User_ID = v.Player_A_ID
              JOIN Account_Base_Table a2 ON a2.User_ID = v.Player_B_ID
              WHERE v.Co_Play_Count >= @min
              ORDER BY v.Co_Play_Count DESC`);
    res.json(result.recordset);
  } catch (err) {
    console.error('Social topology error:', err);
    res.status(500).json({ error: '获取社交拓扑失败' });
  }
});

// GET /api/reports/inventory-turnover
router.get('/inventory-turnover', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`SELECT i.Item_ID, i.Item_Name, i.Item_Category,
                     ISNULL(SUM(CASE WHEN l.Movement_Type = 'Sale_Out' THEN -l.Quantity_Delta ELSE 0 END), 0) AS total_sold,
                     ISNULL(SUM(CASE WHEN l.Movement_Type = 'Purchase_In' THEN l.Quantity_Delta ELSE 0 END), 0) AS total_purchased,
                     i.Current_Stock_Cache, i.Safety_Alert_Threshold
              FROM Dim_Inventory_Item i
              LEFT JOIN Inventory_Movement_Ledger l ON l.Item_ID = i.Item_ID
              WHERE i.Is_Delisted = 0
              GROUP BY i.Item_ID, i.Item_Name, i.Item_Category, i.Current_Stock_Cache, i.Safety_Alert_Threshold
              ORDER BY total_sold DESC`);
    res.json(result.recordset);
  } catch (err) {
    console.error('Inventory turnover error:', err);
    res.status(500).json({ error: '获取库存周转数据失败' });
  }
});

// GET /api/reports/room-utilization — 房间利用率饼图数据
router.get('/room-utilization', async (req, res) => {
  try {
    const pool = await getPool();
    const { from, to } = req.query;

    let query = `
      SELECT
        r.Room_ID,
        r.Room_Name,
        r.Room_Max_Capacity,
        COUNT(s.Session_ID) AS Total_Sessions,
        ISNULL(SUM(DATEDIFF(MINUTE, s.Scheduled_Start_Time, s.Scheduled_End_Time)), 0) AS Total_Minutes_Used
      FROM Dim_Store_Room r
      LEFT JOIN Fact_Session_Schedule s
        ON s.Room_ID = r.Room_ID
        AND s.Session_Status NOT IN ('Aborted')`;
    const request = pool.request();

    if (from) {
      query += ' AND s.Scheduled_Start_Time >= @from';
      request.input('from', sql.DateTime2, from);
    }
    if (to) {
      query += ' AND s.Scheduled_End_Time <= @to';
      request.input('to', sql.DateTime2, to);
    }

    query += `
      GROUP BY r.Room_ID, r.Room_Name, r.Room_Max_Capacity
      ORDER BY Total_Minutes_Used DESC`;

    const result = await request.query(query);

    const totalRooms = result.recordset.length;
    const totalUsed = result.recordset.reduce((sum, r) => sum + r.Total_Minutes_Used, 0);

    // 计算时间窗口（用于绝对利用率分母）
    const now = new Date();
    const effectiveFrom = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1); // 默认当月1日
    const effectiveTo = to ? new Date(to) : now;
    const daysInWindow = Math.max(1, Math.ceil((effectiveTo - effectiveFrom) / (1000 * 60 * 60 * 24)));
    const dailyOperationalMinutes = 16 * 60; // 每日运营 16 小时 (08:00-24:00)
    const totalAvailableMinutes = totalRooms * daysInWindow * dailyOperationalMinutes;

    const rooms = result.recordset.map(r => ({
      room_id: r.Room_ID,
      room_name: r.Room_Name,
      max_capacity: r.Room_Max_Capacity,
      total_sessions: r.Total_Sessions,
      total_minutes_used: r.Total_Minutes_Used,
      share_pct: totalUsed > 0
        ? Math.round((r.Total_Minutes_Used / totalUsed) * 10000) / 100
        : 0,
      utilization_pct: totalAvailableMinutes > 0
        ? Math.round((r.Total_Minutes_Used / (daysInWindow * dailyOperationalMinutes)) * 10000) / 100
        : 0,
    }));

    res.json({
      total_rooms: totalRooms,
      total_minutes_used: totalUsed,
      total_available_minutes: totalAvailableMinutes,
      overall_utilization_pct: totalAvailableMinutes > 0
        ? Math.round((totalUsed / totalAvailableMinutes) * 10000) / 100
        : 0,
      rooms,
    });
  } catch (err) {
    console.error('Room utilization error:', err);
    res.status(500).json({ error: '获取房间利用率失败' });
  }
});

// GET /api/reports/session-status-distribution?from=&to=
router.get('/session-status-distribution', async (req, res) => {
  try {
    const pool = await getPool();
    const { from, to } = req.query;

    let query = `
      SELECT Session_Status, COUNT(*) AS Count
      FROM Fact_Session_Schedule
      WHERE 1=1`;
    const request = pool.request();

    if (from) {
      query += ' AND Scheduled_Start_Time >= @from';
      request.input('from', sql.DateTime2, from);
    }
    if (to) {
      query += ' AND Scheduled_End_Time <= @to';
      request.input('to', sql.DateTime2, to);
    }

    query += ' GROUP BY Session_Status ORDER BY Count DESC';

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('Session status distribution error:', err);
    res.status(500).json({ error: '获取场次状态分布失败' });
  }
});

// GET /api/reports/dm-performance?from=&to=
router.get('/dm-performance', async (req, res) => {
  try {
    const pool = await getPool();
    const { from, to } = req.query;

    let query = `
      SELECT
        dm.DM_User_ID,
        dm.DM_Stage_Name,
        ISNULL(SUM(CASE WHEN s.Session_Status = 'Completed' THEN 1 ELSE 0 END), 0) AS Completed_Sessions,
        ISNULL(SUM(CASE WHEN s.Session_Status IN ('Locked_Ready','In_Progress','Matching') THEN 1 ELSE 0 END), 0) AS Active_Sessions
      FROM DM_Profile_Table dm
      LEFT JOIN Fact_Session_Schedule s
        ON s.DM_User_ID = dm.DM_User_ID`;
    const request = pool.request();

    if (from) {
      query += ' AND s.Scheduled_Start_Time >= @from';
      request.input('from', sql.DateTime2, from);
    }
    if (to) {
      query += ' AND s.Scheduled_End_Time <= @to';
      request.input('to', sql.DateTime2, to);
    }

    query += `
      WHERE dm.Employment_Status IN ('Active','Probation')
      GROUP BY dm.DM_User_ID, dm.DM_Stage_Name
      ORDER BY Completed_Sessions DESC`;

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('DM performance error:', err);
    res.status(500).json({ error: '获取 DM 绩效数据失败' });
  }
});

// GET /api/reports/script-ranking?from=&to=&limit=8
router.get('/script-ranking', async (req, res) => {
  try {
    const pool = await getPool();
    const { from, to, limit = '8' } = req.query;

    let query = `
      SELECT TOP ${parseInt(limit)}
        sc.Script_ID,
        sc.Script_Title,
        COUNT(s.Session_ID) AS Session_Count,
        ISNULL(SUM(s.Frozen_Per_Head_Price * pc.Registered_Count), 0) AS Total_Revenue
      FROM Dim_Script_Dictionary sc
      LEFT JOIN Asset_Script_Copy_Table ac ON ac.Script_ID = sc.Script_ID
      LEFT JOIN Fact_Session_Schedule s ON s.Copy_ID = ac.Copy_ID`;
    const request = pool.request();

    if (from) {
      query += ' AND s.Scheduled_Start_Time >= @from';
      request.input('from', sql.DateTime2, from);
    }
    if (to) {
      query += ' AND s.Scheduled_End_Time <= @to';
      request.input('to', sql.DateTime2, to);
    }

    query += `
      LEFT JOIN vw_Session_Player_Count pc ON pc.Session_ID = s.Session_ID
      WHERE s.Session_Status = 'Completed'
      GROUP BY sc.Script_ID, sc.Script_Title
      ORDER BY Session_Count DESC`;

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('Script ranking error:', err);
    res.status(500).json({ error: '获取剧本排行失败' });
  }
});

// GET /api/reports/genre-revenue?from=&to=
router.get('/genre-revenue', async (req, res) => {
  try {
    const pool = await getPool();
    const { from, to } = req.query;

    let query = `
      SELECT
        ISNULL(gl.Genre_Name, '其他') AS Genre_Name,
        ISNULL(SUM(s.Frozen_Per_Head_Price * pc.Registered_Count), 0) AS Revenue
      FROM Fact_Session_Schedule s
      JOIN Asset_Script_Copy_Table ac ON ac.Copy_ID = s.Copy_ID
      JOIN Dim_Script_Dictionary sc ON sc.Script_ID = ac.Script_ID
      LEFT JOIN Dim_Genre_Lookup gl ON gl.Genre_ID = sc.Primary_Genre
      LEFT JOIN vw_Session_Player_Count pc ON pc.Session_ID = s.Session_ID
      WHERE s.Session_Status = 'Completed'`;
    const request = pool.request();

    if (from) {
      query += ' AND s.Scheduled_Start_Time >= @from';
      request.input('from', sql.DateTime2, from);
    }
    if (to) {
      query += ' AND s.Scheduled_End_Time <= @to';
      request.input('to', sql.DateTime2, to);
    }

    query += `
      GROUP BY gl.Genre_Name
      ORDER BY Revenue DESC`;

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('Genre revenue error:', err);
    res.status(500).json({ error: '获取题材营收数据失败' });
  }
});

// POST /api/reports/generate-snapshots - Admin 手动触发快照生成
router.post('/generate-snapshots', async (req, res) => {
  try {
    const pool = await getPool();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);
    const todayStr = new Date().toISOString().slice(0, 10);

    // 检查昨天快照是否存在
    const existingKpi = await pool.request()
      .input('date', sql.Date, dateStr)
      .query('SELECT COUNT(*) AS cnt FROM Daily_KPI_Snapshot WHERE Snapshot_Date = @date');

    let kpiGenerated = false;
    if (existingKpi.recordset[0].cnt === 0) {
      // 聚合昨天的数据生成 KPI 快照
      await pool.request()
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
      kpiGenerated = true;
    }

    // 检查今天 LTV 快照是否存在
    const existingLtv = await pool.request()
      .input('date', sql.Date, todayStr)
      .query('SELECT COUNT(*) AS cnt FROM Daily_User_LTV_Snapshot WHERE Snapshot_Date = @date');

    let ltvGenerated = false;
    if (existingLtv.recordset[0].cnt === 0) {
      await pool.request()
        .input('date', sql.Date, todayStr)
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
      ltvGenerated = true;
    }

    res.json({
      message: '快照生成检查完成',
      KPI_Generated: kpiGenerated,
      LTV_Generated: ltvGenerated,
      KPI_Date: dateStr,
      LTV_Date: todayStr,
    });
  } catch (err) {
    console.error('Generate snapshots error:', err);
    res.status(500).json({ error: '快照生成失败' });
  }
});

module.exports = router;

const { Router } = require('express');
const { getPool, sql } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const router = Router();
router.use(authenticate);
router.use(authorize(3)); // 全部审计操作仅 Admin

// GET /api/audit-logs
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const { operator, action, entity, from, to, page = 1, size = 50 } = req.query;

    const request = pool.request();
    let query = `SELECT a.*, acc.Account_Name AS Operator_Name
                 FROM System_Audit_Log_Table a
                 LEFT JOIN Account_Base_Table acc ON acc.User_ID = a.Operator_User_ID
                 WHERE 1=1`;

    if (operator) {
      query += ' AND a.Operator_User_ID = @operator';
      request.input('operator', sql.Int, parseInt(operator));
    }
    if (action) {
      query += ' AND a.Action_Type = @action';
      request.input('action', sql.NVarChar(50), action);
    }
    if (entity) {
      query += ' AND a.Target_Entity = @entity';
      request.input('entity', sql.NVarChar(50), entity);
    }
    if (from) {
      query += ' AND a.Logged_At >= @from';
      request.input('from', sql.DateTime2, new Date(from));
    }
    if (to) {
      // 包含结束日期全天
      const toDate = new Date(to);
      toDate.setDate(toDate.getDate() + 1);
      query += ' AND a.Logged_At < @to';
      request.input('to', sql.DateTime2, toDate);
    }

    // 获取总数
    const countQuery = query.replace(/SELECT a\.\*.*?FROM/, 'SELECT COUNT(*) AS total FROM');
    const countResult = await request.query(countQuery);
    const total = countResult.recordset[0].total;

    query += ' ORDER BY a.Logged_At DESC';
    query += ` OFFSET ${(parseInt(page) - 1) * parseInt(size)} ROWS FETCH NEXT ${parseInt(size)} ROWS ONLY`;

    const result = await request.query(query);
    res.json({ records: result.recordset, total, page: parseInt(page), size: parseInt(size) });
  } catch (err) {
    console.error('List audit logs error:', err);
    res.status(500).json({ error: '获取审计日志失败' });
  }
});

// GET /api/audit-logs/stats — 审计统计摘要
router.get('/stats', async (req, res) => {
  try {
    const pool = await getPool();

    // 按操作类型统计
    const byAction = await pool.request().query(`
      SELECT Action_Type, COUNT(*) AS Count
      FROM System_Audit_Log_Table
      WHERE Logged_At >= DATEADD(DAY, -30, SYSUTCDATETIME())
      GROUP BY Action_Type
      ORDER BY Count DESC
    `);

    // 按目标实体统计
    const byEntity = await pool.request().query(`
      SELECT Target_Entity, COUNT(*) AS Count
      FROM System_Audit_Log_Table
      WHERE Logged_At >= DATEADD(DAY, -30, SYSUTCDATETIME())
      GROUP BY Target_Entity
      ORDER BY Count DESC
    `);

    // 每日操作量趋势 (过去30天)
    const dailyTrend = await pool.request().query(`
      SELECT CAST(Logged_At AS DATE) AS Date, COUNT(*) AS Count
      FROM System_Audit_Log_Table
      WHERE Logged_At >= DATEADD(DAY, -30, SYSUTCDATETIME())
      GROUP BY CAST(Logged_At AS DATE)
      ORDER BY Date
    `);

    // 操作者排行
    const topOperators = await pool.request().query(`
      SELECT TOP 10 a.Operator_User_ID, acc.Account_Name, COUNT(*) AS Count
      FROM System_Audit_Log_Table a
      LEFT JOIN Account_Base_Table acc ON acc.User_ID = a.Operator_User_ID
      WHERE a.Logged_At >= DATEADD(DAY, -30, SYSUTCDATETIME())
      GROUP BY a.Operator_User_ID, acc.Account_Name
      ORDER BY Count DESC
    `);

    // 总览
    const overview = await pool.request().query(`
      SELECT
        COUNT(*) AS Total,
        COUNT(DISTINCT Operator_User_ID) AS ActiveOperators,
        COUNT(DISTINCT Action_Type) AS ActionTypes,
        COUNT(DISTINCT Target_Entity) AS EntityTypes,
        MIN(Logged_At) AS Earliest,
        MAX(Logged_At) AS Latest
      FROM System_Audit_Log_Table
    `);

    res.json({
      overview: overview.recordset[0],
      byAction: byAction.recordset,
      byEntity: byEntity.recordset,
      dailyTrend: dailyTrend.recordset,
      topOperators: topOperators.recordset,
    });
  } catch (err) {
    console.error('Audit stats error:', err);
    res.status(500).json({ error: '获取审计统计失败' });
  }
});

// GET /api/audit-logs/:id
router.get('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.BigInt, parseInt(req.params.id))
      .query(`
        SELECT a.*, acc.Account_Name AS Operator_Name
        FROM System_Audit_Log_Table a
        LEFT JOIN Account_Base_Table acc ON acc.User_ID = a.Operator_User_ID
        WHERE a.Audit_ID = @id
      `);
    if (result.recordset.length === 0) return res.status(404).json({ error: '审计日志不存在' });
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Get audit log error:', err);
    res.status(500).json({ error: '获取审计日志失败' });
  }
});

module.exports = router;

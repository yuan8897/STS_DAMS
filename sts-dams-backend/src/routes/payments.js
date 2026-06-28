const { Router } = require('express');
const { getPool, sql } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const router = Router();
router.use(authenticate);

// POST /api/payments
router.post('/', authorize(2, 3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const { Registration_ID, Transaction_Type, Amount, Payment_Method, External_Reference_No, Remarks } = req.body;

    if (!Registration_ID || !Transaction_Type || !Amount || !Payment_Method) {
      return res.status(400).json({ error: '缺少必填参数' });
    }
    if (!['Deposit', 'Final_Payment', 'Refund', 'Adjustment'].includes(Transaction_Type)) {
      return res.status(400).json({ error: '无效的交易类型' });
    }
    if (!['WeChat', 'Alipay', 'Cash', 'Bank_Card', 'Member_Balance'].includes(Payment_Method)) {
      return res.status(400).json({ error: '无效的支付方式' });
    }

    // 验证 Registration 存在
    const reg = await pool.request()
      .input('regId', sql.BigInt, Registration_ID)
      .query('SELECT Registration_ID FROM Bridge_Player_Registration WHERE Registration_ID = @regId');
    if (reg.recordset.length === 0) return res.status(404).json({ error: '参团记录不存在' });

    const result = await pool.request()
      .input('storeId', sql.Int, req.storeId)
      .input('regId', sql.BigInt, Registration_ID)
      .input('type', sql.NVarChar, Transaction_Type)
      .input('amount', sql.Decimal(10, 2), Amount)
      .input('method', sql.NVarChar, Payment_Method)
      .input('ref', sql.NVarChar, External_Reference_No || null)
      .input('remarks', sql.NVarChar, Remarks || null)
      .input('operator', sql.Int, req.user.User_ID)
      .query(`INSERT INTO Payment_Transaction_Table
              (Store_ID, Registration_ID, Transaction_Type, Amount, Payment_Method, External_Reference_No, Operator_User_ID, Remarks)
              OUTPUT INSERTED.Transaction_ID
              VALUES (@storeId, @regId, @type, @amount, @method, @ref, @operator, @remarks)`);

    // trg_Payment_SyncCachedStatus 自动触发
    res.status(201).json({
      Transaction_ID: result.recordset[0].Transaction_ID,
      message: '支付记录创建成功',
    });
  } catch (err) {
    console.error('Create payment error:', err);
    if (err.originalError) {
      return res.status(400).json({ error: err.originalError.message });
    }
    res.status(500).json({ error: '创建支付记录失败' });
  }
});

// POST /api/payments/refund
router.post('/refund', authorize(3), async (req, res) => {
  try {
    const pool = await getPool();
    const { Registration_ID, Amount, Payment_Method, Remarks } = req.body;

    if (Amount >= 0) return res.status(400).json({ error: '退款金额必须为负数' });

    const result = await pool.request()
      .input('storeId', sql.Int, req.storeId)
      .input('regId', sql.BigInt, Registration_ID)
      .input('amount', sql.Decimal(10, 2), Amount)
      .input('method', sql.NVarChar, Payment_Method)
      .input('remarks', sql.NVarChar, Remarks || '退款')
      .input('operator', sql.Int, req.user.User_ID)
      .query(`INSERT INTO Payment_Transaction_Table
              (Store_ID, Registration_ID, Transaction_Type, Amount, Payment_Method, Operator_User_ID, Remarks)
              OUTPUT INSERTED.Transaction_ID
              VALUES (@storeId, @regId, 'Refund', @amount, @method, @operator, @remarks)`);

    res.status(201).json({
      Transaction_ID: result.recordset[0].Transaction_ID,
      message: '退款记录创建成功',
    });
  } catch (err) {
    console.error('Refund error:', err);
    res.status(500).json({ error: '退款失败' });
  }
});

// GET /api/payments — 查询支付历史（按用户/场次/日期筛选）
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const { user_id, session_id, from, to } = req.query;

    let query = `
      SELECT pt.*, reg.Session_ID, reg.Player_User_ID,
             a.Account_Name AS Player_Name
      FROM Payment_Transaction_Table pt
      JOIN Bridge_Player_Registration reg ON reg.Registration_ID = pt.Registration_ID
      JOIN Account_Base_Table a ON a.User_ID = reg.Player_User_ID
      WHERE 1=1`;
    const request = pool.request();

    if (user_id) {
      query += ' AND reg.Player_User_ID = @userId';
      request.input('userId', sql.Int, parseInt(user_id));
    }
    if (session_id) {
      query += ' AND reg.Session_ID = @sessionId';
      request.input('sessionId', sql.BigInt, parseInt(session_id));
    }
    if (from) {
      query += ' AND pt.Processed_At >= @from';
      request.input('from', sql.DateTime2, from);
    }
    if (to) {
      query += ' AND pt.Processed_At <= @to';
      request.input('to', sql.DateTime2, to);
    }

    // 非 Admin 用户只能查看自己的支付记录
    if (req.user.Role_Type !== 3) {
      query += ' AND reg.Player_User_ID = @selfId';
      request.input('selfId', sql.Int, req.user.User_ID);
    }

    query += ' ORDER BY pt.Processed_At DESC';

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('List payments error:', err);
    res.status(500).json({ error: '获取支付记录失败' });
  }
});

// GET /api/payments/daily-summary
router.get('/daily-summary', authorize(3), async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date 参数必填' });
    const pool = await getPool();

    const result = await pool.request()
      .input('date', sql.NVarChar, date)
      .query(`SELECT
                ISNULL(SUM(CASE WHEN Transaction_Type = 'Deposit' THEN Amount ELSE 0 END), 0) AS total_deposit,
                ISNULL(SUM(CASE WHEN Transaction_Type = 'Final_Payment' THEN Amount ELSE 0 END), 0) AS total_final_payment,
                ISNULL(SUM(CASE WHEN Transaction_Type = 'Refund' THEN Amount ELSE 0 END), 0) AS total_refund,
                ISNULL(SUM(CASE WHEN Transaction_Type = 'Adjustment' THEN Amount ELSE 0 END), 0) AS total_adjustment,
                ISNULL(SUM(Amount), 0) AS net_revenue
              FROM Payment_Transaction_Table
              WHERE CAST(Processed_At AS DATE) = @date`);

    const byMethod = await pool.request()
      .input('date', sql.NVarChar, date)
      .query(`SELECT Payment_Method, ISNULL(SUM(Amount), 0) AS total
              FROM Payment_Transaction_Table
              WHERE CAST(Processed_At AS DATE) = @date
              GROUP BY Payment_Method`);

    const methods = {};
    for (const row of byMethod.recordset) methods[row.Payment_Method] = row.total;

    res.json({ date, ...result.recordset[0], by_method: methods });
  } catch (err) {
    console.error('Daily summary error:', err);
    res.status(500).json({ error: '获取对账汇总失败' });
  }
});

module.exports = router;

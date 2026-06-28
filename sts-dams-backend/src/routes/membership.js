const { Router } = require('express');
const { getPool, sql } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize, allowAdminOrSelf } = require('../middleware/authorize');

const router = Router();
router.use(authenticate);

// GET /api/membership/levels - 所有登录用户可查看等级列表
router.get('/levels', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT * FROM Dim_Member_Level ORDER BY Min_Required_Points');
    res.json(result.recordset);
  } catch (err) {
    console.error('List member levels error:', err);
    res.status(500).json({ error: '获取会员等级列表失败' });
  }
});

// POST /api/membership/levels - Admin/Store_Manager 创建等级
router.post('/levels', authorize(3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const { Level_Name, Min_Required_Points, Discount_Rate, Point_Earning_Multiplier } = req.body;
    if (!Level_Name || Min_Required_Points === undefined || !Discount_Rate) {
      return res.status(400).json({ error: '缺少必填参数' });
    }

    const result = await pool.request()
      .input('name', sql.NVarChar, Level_Name)
      .input('minPoints', sql.Int, Min_Required_Points)
      .input('discount', sql.Decimal(4, 3), Discount_Rate)
      .input('multiplier', sql.Decimal(3, 2), Point_Earning_Multiplier || 1.00)
      .query(`INSERT INTO Dim_Member_Level (Level_Name, Min_Required_Points, Discount_Rate, Point_Earning_Multiplier)
              OUTPUT INSERTED.Level_ID
              VALUES (@name, @minPoints, @discount, @multiplier)`);

    res.status(201).json({ Level_ID: result.recordset[0].Level_ID, message: '会员等级创建成功' });
  } catch (err) {
    console.error('Create level error:', err);
    if (err.originalError) return res.status(400).json({ error: err.originalError.message });
    res.status(500).json({ error: '创建会员等级失败' });
  }
});

// PUT /api/membership/levels/:id - Admin/Store_Manager 更新等级
router.put('/levels/:id', authorize(3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const { Level_Name, Min_Required_Points, Discount_Rate, Point_Earning_Multiplier } = req.body;

    const result = await pool.request()
      .input('id', sql.TinyInt, parseInt(req.params.id))
      .input('name', sql.NVarChar, Level_Name)
      .input('minPoints', sql.Int, Min_Required_Points)
      .input('discount', sql.Decimal(4, 3), Discount_Rate)
      .input('multiplier', sql.Decimal(3, 2), Point_Earning_Multiplier || 1.00)
      .query(`UPDATE Dim_Member_Level SET
                Level_Name = @name, Min_Required_Points = @minPoints,
                Discount_Rate = @discount, Point_Earning_Multiplier = @multiplier
              WHERE Level_ID = @id`);

    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: '等级不存在' });
    res.json({ message: '会员等级更新成功' });
  } catch (err) {
    console.error('Update level error:', err);
    if (err.originalError) return res.status(400).json({ error: err.originalError.message });
    res.status(500).json({ error: '更新会员等级失败' });
  }
});

// DELETE /api/membership/levels/:id —— Admin/Store_Manager 删除等级
router.delete('/levels/:id', authorize(3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const levelId = parseInt(req.params.id);

    // 检查是否有用户使用此等级
    const users = await pool.request()
      .input('id', sql.TinyInt, levelId)
      .query(`SELECT a.Account_Name FROM User_Member_Profile mp
              JOIN Account_Base_Table a ON a.User_ID = mp.User_ID
              WHERE mp.Current_Level_ID = @id`);

    if (users.recordset.length > 0) {
      const names = users.recordset.map(u => u.Account_Name).join('、');
      return res.status(409).json({
        error: '该等级下存在会员，无法删除',
        detail: `以下会员当前为此等级: ${names}`,
      });
    }

    await pool.request()
      .input('id', sql.TinyInt, levelId)
      .query('DELETE FROM Dim_Member_Level WHERE Level_ID = @id');

    res.json({ message: '会员等级已删除' });
  } catch (err) {
    console.error('Delete level error:', err);
    if (err.originalError) return res.status(400).json({ error: err.originalError.message });
    res.status(500).json({ error: '删除会员等级失败' });
  }
});

// GET /api/membership/profile - 当前用户的会员档案
router.get('/profile', async (req, res) => {
  try {
    const pool = await getPool();
    let result = await pool.request()
      .input('userId', sql.Int, req.user.User_ID)
      .query(`SELECT mp.*, ml.Level_Name, ml.Discount_Rate, ml.Point_Earning_Multiplier
              FROM User_Member_Profile mp
              JOIN Dim_Member_Level ml ON ml.Level_ID = mp.Current_Level_ID
              WHERE mp.User_ID = @userId`);

    if (result.recordset.length === 0) {
      // 自动创建会员档案
      await pool.request()
        .input('userId', sql.Int, req.user.User_ID)
        .query(`INSERT INTO User_Member_Profile (User_ID, Accumulated_Points, Current_Level_ID, Total_Lifetime_Points)
                VALUES (@userId, 0, 1, 0)`);

      result = await pool.request()
        .input('userId', sql.Int, req.user.User_ID)
        .query(`SELECT mp.*, ml.Level_Name, ml.Discount_Rate, ml.Point_Earning_Multiplier
                FROM User_Member_Profile mp
                JOIN Dim_Member_Level ml ON ml.Level_ID = mp.Current_Level_ID
                WHERE mp.User_ID = @userId`);
    }

    // 查找下一级所需积分
    const nextLevel = await pool.request()
      .input('currentPoints', sql.Int, result.recordset[0].Accumulated_Points)
      .query(`SELECT TOP 1 * FROM Dim_Member_Level
              WHERE Min_Required_Points > @currentPoints
              ORDER BY Min_Required_Points`);

    res.json({
      ...result.recordset[0],
      Next_Level: nextLevel.recordset[0] || null,
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: '获取会员档案失败' });
  }
});

// GET /api/membership/users/:id/points - Admin/Store_Manager 查看用户积分
router.get('/users/:id/points', authorize(3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.Int, parseInt(req.params.id))
      .query(`SELECT mp.*, ml.Level_Name, ml.Discount_Rate, a.Account_Name
              FROM User_Member_Profile mp
              JOIN Dim_Member_Level ml ON ml.Level_ID = mp.Current_Level_ID
              JOIN Account_Base_Table a ON a.User_ID = mp.User_ID
              WHERE mp.User_ID = @userId`);

    if (result.recordset.length === 0) return res.status(404).json({ error: '用户会员档案不存在' });
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Get user points error:', err);
    res.status(500).json({ error: '获取用户积分失败' });
  }
});

// GET /api/membership/users/:id/points/ledger - 积分流水
router.get('/users/:id/points/ledger', allowAdminOrSelf('id'), async (req, res) => {
  try {
    const pool = await getPool();
    const { type } = req.query;
    let query = `SELECT l.*, a.Account_Name AS Operator_Name
                 FROM Member_Points_Ledger l
                 LEFT JOIN Account_Base_Table a ON a.User_ID = l.Operator_User_ID
                 WHERE l.User_ID = @userId`;
    if (type) query += ` AND l.Transaction_Type = @type`;
    query += ' ORDER BY l.Created_At DESC';

    const request = pool.request()
      .input('userId', sql.Int, parseInt(req.params.id));
    if (type) request.input('type', sql.NVarChar, type);

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('Get points ledger error:', err);
    res.status(500).json({ error: '获取积分流水失败' });
  }
});

// POST /api/membership/users/:id/points/manual - Admin/Store_Manager 手动调整积分
router.post('/users/:id/points/manual', authorize(3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const userId = parseInt(req.params.id);
    const { Points_Delta, Remarks } = req.body;

    if (!Points_Delta || Points_Delta === 0) {
      return res.status(400).json({ error: '积分变动额不能为0' });
    }

    const transaction = new sql.Transaction(await getPool());
    await transaction.begin();

    try {
      // 获取当前积分
      const profile = await transaction.request()
        .input('userId', sql.Int, userId)
        .query(`SELECT Accumulated_Points FROM User_Member_Profile WHERE User_ID = @userId`);

      if (profile.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ error: '用户会员档案不存在' });
      }

      const currentPoints = profile.recordset[0].Accumulated_Points;
      const newBalance = currentPoints + Points_Delta;
      if (newBalance < 0) {
        await transaction.rollback();
        return res.status(400).json({ error: '积分不足，扣减后余额不能为负' });
      }

      // 写入积分流水
      await transaction.request()
        .input('userId', sql.Int, userId)
        .input('delta', sql.Int, Points_Delta)
        .input('type', sql.NVarChar, Points_Delta > 0 ? 'Earn_Manual' : 'Adjust')
        .input('balance', sql.Int, newBalance)
        .input('operator', sql.Int, req.user.User_ID)
        .input('remarks', sql.NVarChar, Remarks || '手动调整')
        .query(`INSERT INTO Member_Points_Ledger (User_ID, Points_Delta, Transaction_Type, Points_Balance_After, Operator_User_ID, Remarks)
                VALUES (@userId, @delta, @type, @balance, @operator, @remarks)`);

      // 更新积分余额
      await transaction.request()
        .input('userId', sql.Int, userId)
        .input('delta', sql.Int, Points_Delta)
        .query(`UPDATE User_Member_Profile SET
                  Accumulated_Points = Accumulated_Points + @delta,
                  Total_Lifetime_Points = Total_Lifetime_Points + CASE WHEN @delta > 0 THEN @delta ELSE 0 END
                WHERE User_ID = @userId`);

      await transaction.commit();
      res.json({ message: '积分调整成功', New_Balance: newBalance });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('Manual points error:', err);
    if (err.originalError) return res.status(400).json({ error: err.originalError.message });
    res.status(500).json({ error: '积分调整失败' });
  }
});

// POST /api/membership/users/:id/points/redeem - 积分兑换抵扣
router.post('/users/:id/points/redeem', authorize(2, 3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const userId = parseInt(req.params.id);
    const { Points_To_Redeem, Order_Amount, Remarks } = req.body;

    if (!Points_To_Redeem || Points_To_Redeem <= 0) {
      return res.status(400).json({ error: '兑换积分必须大于0' });
    }

    // 100 积分 = 1 元，最多抵扣 30%
    const maxRedeemPoints = Math.floor(Order_Amount * 0.3 * 100);
    if (Points_To_Redeem > maxRedeemPoints) {
      return res.status(400).json({ error: `积分抵扣不能超过订单金额的30%（最多${maxRedeemPoints}分）` });
    }

    const transaction = new sql.Transaction(await getPool());
    await transaction.begin();

    try {
      const profile = await transaction.request()
        .input('userId', sql.Int, userId)
        .query(`SELECT Accumulated_Points FROM User_Member_Profile WHERE User_ID = @userId`);

      if (profile.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ error: '用户会员档案不存在' });
      }

      const currentPoints = profile.recordset[0].Accumulated_Points;
      if (currentPoints < Points_To_Redeem) {
        await transaction.rollback();
        return res.status(400).json({ error: '可用积分不足' });
      }

      const newBalance = currentPoints - Points_To_Redeem;
      const redeemAmount = (Points_To_Redeem / 100).toFixed(2);

      await transaction.request()
        .input('userId', sql.Int, userId)
        .input('delta', sql.Int, -Points_To_Redeem)
        .input('balance', sql.Int, newBalance)
        .input('operator', sql.Int, req.user.User_ID)
        .input('remarks', sql.NVarChar, Remarks || `积分兑换抵扣 ¥${redeemAmount}`)
        .query(`INSERT INTO Member_Points_Ledger (User_ID, Points_Delta, Transaction_Type, Points_Balance_After, Operator_User_ID, Remarks)
                VALUES (@userId, @delta, 'Redeem_Cash', @balance, @operator, @remarks)`);

      await transaction.request()
        .input('userId', sql.Int, userId)
        .input('delta', sql.Int, -Points_To_Redeem)
        .query(`UPDATE User_Member_Profile SET Accumulated_Points = Accumulated_Points + @delta WHERE User_ID = @userId`);

      await transaction.commit();
      res.json({ message: '积分兑换成功', Redeemed_Points: Points_To_Redeem, Redeem_Amount: parseFloat(redeemAmount), New_Balance: newBalance });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('Redeem points error:', err);
    if (err.originalError) return res.status(400).json({ error: err.originalError.message });
    res.status(500).json({ error: '积分兑换失败' });
  }
});

module.exports = router;

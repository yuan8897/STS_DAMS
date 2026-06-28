const { Router } = require('express');
const { getPool, sql } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const router = Router();
router.use(authenticate);

// GET /api/coupons/templates - Admin/Store_Manager 查看模板列表
router.get('/templates', authorize(3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`SELECT t.*, s.Script_Title
              FROM Coupon_Template t
              LEFT JOIN Dim_Script_Dictionary s ON s.Script_ID = t.Applicable_Script_ID
              ORDER BY t.Created_At DESC`);
    res.json(result.recordset);
  } catch (err) {
    console.error('List templates error:', err);
    res.status(500).json({ error: '获取优惠券模板列表失败' });
  }
});

// POST /api/coupons/templates - Admin/Store_Manager 创建模板
router.post('/templates', authorize(3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const { Coupon_Name, Discount_Type, Discount_Value, Min_Order_Amount, Max_Discount_Cap,
            Valid_Days_From_Issue, Applicable_Script_ID, Total_Issuance_Limit, Per_User_Limit } = req.body;

    if (!Coupon_Name || !Discount_Type || !Discount_Value || !Valid_Days_From_Issue) {
      return res.status(400).json({ error: '缺少必填参数' });
    }
    if (!['Fixed_Amount', 'Percent_Off'].includes(Discount_Type)) {
      return res.status(400).json({ error: '无效的优惠类型' });
    }
    // Percent_Off 范围校验：0 < value <= 1（即 0% ~ 100%）
    if (Discount_Type === 'Percent_Off' && (Discount_Value <= 0 || Discount_Value > 1)) {
      return res.status(400).json({ error: '折扣百分比必须在 0 到 1 之间（例如 0.2 表示 8 折）' });
    }
    if (Discount_Type === 'Fixed_Amount' && Discount_Value <= 0) {
      return res.status(400).json({ error: '固定金额优惠必须大于 0' });
    }

    const result = await pool.request()
      .input('name', sql.NVarChar, Coupon_Name)
      .input('type', sql.NVarChar, Discount_Type)
      .input('value', sql.Decimal(10, 2), Discount_Value)
      .input('minOrder', sql.Decimal(10, 2), Min_Order_Amount || 0)
      .input('maxCap', sql.Decimal(10, 2), Max_Discount_Cap || null)
      .input('validDays', sql.Int, Valid_Days_From_Issue)
      .input('scriptId', sql.Int, Applicable_Script_ID || null)
      .input('totalLimit', sql.Int, Total_Issuance_Limit || null)
      .input('perUser', sql.Int, Per_User_Limit || 1)
      .input('creator', sql.Int, req.user.User_ID)
      .query(`INSERT INTO Coupon_Template (Coupon_Name, Discount_Type, Discount_Value, Min_Order_Amount,
                Max_Discount_Cap, Valid_Days_From_Issue, Applicable_Script_ID, Total_Issuance_Limit,
                Per_User_Limit, Created_By_User_ID)
              OUTPUT INSERTED.Template_ID
              VALUES (@name, @type, @value, @minOrder, @maxCap, @validDays, @scriptId, @totalLimit,
                      @perUser, @creator)`);

    res.status(201).json({ Template_ID: result.recordset[0].Template_ID, message: '优惠券模板创建成功' });
  } catch (err) {
    console.error('Create template error:', err);
    if (err.originalError) return res.status(400).json({ error: err.originalError.message });
    res.status(500).json({ error: '创建优惠券模板失败' });
  }
});

// PUT /api/coupons/templates/:id - Admin/Store_Manager 更新模板
router.put('/templates/:id', authorize(3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const { Coupon_Name, Discount_Type, Discount_Value, Min_Order_Amount, Max_Discount_Cap,
            Valid_Days_From_Issue, Applicable_Script_ID, Total_Issuance_Limit, Per_User_Limit } = req.body;

    const result = await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .input('name', sql.NVarChar, Coupon_Name)
      .input('type', sql.NVarChar, Discount_Type)
      .input('value', sql.Decimal(10, 2), Discount_Value)
      .input('minOrder', sql.Decimal(10, 2), Min_Order_Amount || 0)
      .input('maxCap', sql.Decimal(10, 2), Max_Discount_Cap || null)
      .input('validDays', sql.Int, Valid_Days_From_Issue)
      .input('scriptId', sql.Int, Applicable_Script_ID || null)
      .input('totalLimit', sql.Int, Total_Issuance_Limit || null)
      .input('perUser', sql.Int, Per_User_Limit || 1)
      .query(`UPDATE Coupon_Template SET
                Coupon_Name = @name, Discount_Type = @type, Discount_Value = @value,
                Min_Order_Amount = @minOrder, Max_Discount_Cap = @maxCap,
                Valid_Days_From_Issue = @validDays, Applicable_Script_ID = @scriptId,
                Total_Issuance_Limit = @totalLimit, Per_User_Limit = @perUser
              WHERE Template_ID = @id`);

    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: '模板不存在' });
    res.json({ message: '优惠券模板更新成功' });
  } catch (err) {
    console.error('Update template error:', err);
    if (err.originalError) return res.status(400).json({ error: err.originalError.message });
    res.status(500).json({ error: '更新优惠券模板失败' });
  }
});

// PUT /api/coupons/templates/:id/toggle - Admin/Store_Manager 启停模板
router.put('/templates/:id/toggle', authorize(3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .query(`UPDATE Coupon_Template SET Is_Active = CASE WHEN Is_Active = 1 THEN 0 ELSE 1 END
              WHERE Template_ID = @id`);

    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: '模板不存在' });
    res.json({ message: '模板状态切换成功' });
  } catch (err) {
    console.error('Toggle template error:', err);
    res.status(500).json({ error: '切换模板状态失败' });
  }
});

// GET /api/coupons/wallet - 当前用户的优惠券钱包
router.get('/wallet', async (req, res) => {
  try {
    const pool = await getPool();
    const { status } = req.query;
    let query = `SELECT c.*, t.Coupon_Name, t.Discount_Type, t.Discount_Value,
                        t.Min_Order_Amount, t.Max_Discount_Cap, t.Applicable_Script_ID,
                        s.Script_Title
                 FROM User_Coupon_Instance c
                 JOIN Coupon_Template t ON t.Template_ID = c.Template_ID
                 LEFT JOIN Dim_Script_Dictionary s ON s.Script_ID = t.Applicable_Script_ID
                 WHERE c.User_ID = @userId`;
    if (status) query += ` AND c.Coupon_Status = @status`;
    query += ' ORDER BY c.Expires_At ASC';

    const request = pool.request().input('userId', sql.Int, req.user.User_ID);
    if (status) request.input('status', sql.NVarChar, status);

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('Get wallet error:', err);
    res.status(500).json({ error: '获取优惠券钱包失败' });
  }
});

// GET /api/coupons/instances - Admin/Store_Manager 查看所有优惠券实例（支持验证码查找）
router.get('/instances', authorize(3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const { template_id, status, user_id, verification_code } = req.query;

    let query = `SELECT c.*, t.Coupon_Name, t.Discount_Type, t.Discount_Value,
                        t.Min_Order_Amount, t.Max_Discount_Cap, t.Applicable_Script_ID,
                        s.Script_Title, a.Account_Name
                 FROM User_Coupon_Instance c
                 JOIN Coupon_Template t ON t.Template_ID = c.Template_ID
                 LEFT JOIN Dim_Script_Dictionary s ON s.Script_ID = t.Applicable_Script_ID
                 JOIN Account_Base_Table a ON a.User_ID = c.User_ID
                 WHERE 1=1`;
    const request = pool.request();

    if (template_id) {
      query += ' AND c.Template_ID = @templateId';
      request.input('templateId', sql.Int, parseInt(template_id));
    }
    if (status) {
      query += ' AND c.Coupon_Status = @status';
      request.input('status', sql.NVarChar, status);
    }
    if (user_id) {
      query += ' AND c.User_ID = @userId';
      request.input('userId', sql.Int, parseInt(user_id));
    }
    if (verification_code) {
      query += ' AND c.Verification_Code = @vcode';
      request.input('vcode', sql.NChar(4), verification_code);
    }

    query += ' ORDER BY c.Issued_At DESC';

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('List instances error:', err);
    res.status(500).json({ error: '获取优惠券实例列表失败' });
  }
});

// POST /api/coupons/issue - Admin/Store_Manager 发放优惠券（含4位验证码生成）
router.post('/issue', authorize(3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const { Template_ID, User_IDs } = req.body;

    if (!Template_ID || !User_IDs || !Array.isArray(User_IDs) || User_IDs.length === 0) {
      return res.status(400).json({ error: '缺少必填参数' });
    }

    // 获取模板信息
    const template = await pool.request()
      .input('id', sql.Int, Template_ID)
      .query('SELECT * FROM Coupon_Template WHERE Template_ID = @id');
    if (template.recordset.length === 0) return res.status(404).json({ error: '模板不存在' });
    const t = template.recordset[0];

    if (!t.Is_Active) return res.status(400).json({ error: '模板已停用' });

    // 获取已使用的验证码集合
    const usedCodes = await pool.request()
      .query('SELECT Verification_Code FROM User_Coupon_Instance WHERE Verification_Code IS NOT NULL');
    const usedCodeSet = new Set(usedCodes.recordset.map(r => r.Verification_Code));

    // 生成不重复4位数字验证码
    function generateCode() {
      let code;
      do {
        code = String(Math.floor(1000 + Math.random() * 9000));
      } while (usedCodeSet.has(code));
      usedCodeSet.add(code);
      return code;
    }

    // 获取所有目标用户的账号名（用于返回详情）
    // User_IDs 已由上层校验为整数数组，安全拼接 IN 子句
    const userIdList = User_IDs.map(id => parseInt(id)).filter(id => !isNaN(id));
    const userNames = await pool.request()
      .query(`SELECT User_ID, Account_Name FROM Account_Base_Table WHERE User_ID IN (${userIdList.join(',')})`);

    const issued = [];
    const issuedDetails = [];
    const skipped = [];

    for (const userId of User_IDs) {
      try {
        // 检查每人限领
        const existing = await pool.request()
          .input('tid', sql.Int, Template_ID)
          .input('uid', sql.Int, userId)
          .query(`SELECT COUNT(*) AS cnt FROM User_Coupon_Instance
                  WHERE Template_ID = @tid AND User_ID = @uid`);
        if (existing.recordset[0].cnt >= t.Per_User_Limit) {
          skipped.push(userId);
          continue;
        }

        // 检查全店总量
        if (t.Total_Issuance_Limit) {
          const total = await pool.request()
            .input('tid', sql.Int, Template_ID)
            .query('SELECT COUNT(*) AS cnt FROM User_Coupon_Instance WHERE Template_ID = @tid');
          if (total.recordset[0].cnt >= t.Total_Issuance_Limit) {
            skipped.push(userId);
            continue;
          }
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + t.Valid_Days_From_Issue);
        const vcode = generateCode();

        await pool.request()
          .input('tid', sql.Int, Template_ID)
          .input('uid', sql.Int, userId)
          .input('expires', sql.DateTime2, expiresAt)
          .input('issuer', sql.Int, req.user.User_ID)
          .input('vcode', sql.NChar(4), vcode)
          .query(`INSERT INTO User_Coupon_Instance (Template_ID, User_ID, Coupon_Status, Issued_At, Expires_At, Issued_By_User_ID, Verification_Code)
                  VALUES (@tid, @uid, 'Unused', SYSUTCDATETIME(), @expires, @issuer, @vcode)`);

        const userRec = userNames.recordset.find(r => r.User_ID === userId);
        issued.push(userId);
        issuedDetails.push({
          User_ID: userId,
          Account_Name: userRec ? userRec.Account_Name : `User#${userId}`,
          Verification_Code: vcode,
          Coupon_Name: t.Coupon_Name,
          Discount_Type: t.Discount_Type,
          Discount_Value: t.Discount_Value,
          Expires_At: expiresAt.toISOString(),
        });
      } catch (err) {
        console.error(`Failed to issue coupon to user ${userId}:`, err.message || err);
        skipped.push(userId);
      }
    }

    res.status(201).json({
      message: `发放完成：成功 ${issued.length} 张，跳过 ${skipped.length} 张`,
      Issued_Count: issued.length,
      Skipped_Count: skipped.length,
      Issued_Details: issuedDetails,
    });
  } catch (err) {
    console.error('Issue coupons error:', err);
    if (err.originalError) return res.status(400).json({ error: err.originalError.message });
    res.status(500).json({ error: '发放优惠券失败' });
  }
});

// POST /api/coupons/redeem - 核销优惠券
router.post('/redeem', authorize(2, 3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const { Coupon_ID, Transaction_ID, Order_Amount } = req.body;

    if (!Coupon_ID || !Transaction_ID) {
      return res.status(400).json({ error: '缺少必填参数' });
    }

    // 验证优惠券
    const coupon = await pool.request()
      .input('id', sql.BigInt, Coupon_ID)
      .query(`SELECT c.*, t.Discount_Type, t.Discount_Value, t.Min_Order_Amount, t.Max_Discount_Cap,
                     t.Coupon_Name
              FROM User_Coupon_Instance c
              JOIN Coupon_Template t ON t.Template_ID = c.Template_ID
              WHERE c.Coupon_ID = @id`);

    if (coupon.recordset.length === 0) return res.status(404).json({ error: '优惠券不存在' });
    const c = coupon.recordset[0];

    if (c.Coupon_Status !== 'Unused') return res.status(400).json({ error: '优惠券已使用或已过期' });
    if (new Date(c.Expires_At) < new Date()) return res.status(400).json({ error: '优惠券已过期' });

    // 检查最低消费
    if (Order_Amount !== undefined && Order_Amount !== null && Order_Amount < c.Min_Order_Amount) {
      return res.status(400).json({ error: `未达到最低消费 ¥${c.Min_Order_Amount}` });
    }

    // 计算抵扣金额
    let discountAmount = 0;
    if (c.Discount_Type === 'Fixed_Amount') {
      discountAmount = parseFloat(c.Discount_Value);
    } else {
      discountAmount = (Order_Amount || 0) * parseFloat(c.Discount_Value);
      if (c.Max_Discount_Cap) discountAmount = Math.min(discountAmount, parseFloat(c.Max_Discount_Cap));
    }
    discountAmount = Math.min(discountAmount, Order_Amount || discountAmount);

    const transaction = new sql.Transaction(await getPool());
    await transaction.begin();

    try {
      await transaction.request()
        .input('id', sql.BigInt, Coupon_ID)
        .query(`UPDATE User_Coupon_Instance SET Coupon_Status = 'Used', Used_At = SYSUTCDATETIME()
                WHERE Coupon_ID = @id`);

      await transaction.request()
        .input('couponId', sql.BigInt, Coupon_ID)
        .input('txnId', sql.BigInt, Transaction_ID)
        .input('amount', sql.Decimal(10, 2), discountAmount)
        .query(`INSERT INTO Discount_Usage_Log (Coupon_ID, Transaction_ID, Discount_Amount)
                VALUES (@couponId, @txnId, @amount)`);

      await transaction.commit();
      res.json({ message: '优惠券核销成功', Discount_Amount: discountAmount });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('Redeem coupon error:', err);
    if (err.originalError) return res.status(400).json({ error: err.originalError.message });
    res.status(500).json({ error: '优惠券核销失败' });
  }
});

// GET /api/coupons/player/:userId —— DM查看玩家可用优惠券
router.get('/player/:userId', authorize(2, 3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const userId = parseInt(req.params.userId);
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`SELECT c.*, t.Coupon_Name, t.Discount_Type, t.Discount_Value,
                     t.Min_Order_Amount, t.Max_Discount_Cap, t.Applicable_Script_ID,
                     s.Script_Title
              FROM User_Coupon_Instance c
              JOIN Coupon_Template t ON t.Template_ID = c.Template_ID
              LEFT JOIN Dim_Script_Dictionary s ON s.Script_ID = t.Applicable_Script_ID
              WHERE c.User_ID = @userId AND c.Coupon_Status = 'Unused'
              ORDER BY c.Expires_At ASC`);
    res.json(result.recordset);
  } catch (err) {
    console.error('Get player coupons error:', err);
    res.status(500).json({ error: '获取玩家优惠券失败' });
  }
});

// POST /api/coupons/verify-by-code —— DM通过4位验证码核销优惠券
// 支持 preview=true 参数，仅查询不核销（Admin预览用）
router.post('/verify-by-code', authorize(2, 3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const { Verification_Code, Transaction_ID, Order_Amount, preview } = req.body;

    if (!Verification_Code) {
      return res.status(400).json({ error: '缺少验证码' });
    }

    // 查找验证码对应的优惠券
    const coupon = await pool.request()
      .input('code', sql.NChar(4), Verification_Code)
      .query(`SELECT c.*, t.Coupon_Name, t.Discount_Type, t.Discount_Value,
                     t.Min_Order_Amount, t.Max_Discount_Cap, t.Applicable_Script_ID,
                     s.Script_Title, a.Account_Name
              FROM User_Coupon_Instance c
              JOIN Coupon_Template t ON t.Template_ID = c.Template_ID
              LEFT JOIN Dim_Script_Dictionary s ON s.Script_ID = t.Applicable_Script_ID
              JOIN Account_Base_Table a ON a.User_ID = c.User_ID
              WHERE c.Verification_Code = @code`);

    if (coupon.recordset.length === 0) {
      return res.status(404).json({ error: '验证码无效，未找到对应优惠券' });
    }
    const c = coupon.recordset[0];

    if (c.Coupon_Status !== 'Unused') {
      return res.status(400).json({ error: `优惠券状态为"${c.Coupon_Status}"，无法核销` });
    }
    if (new Date(c.Expires_At) < new Date()) {
      return res.status(400).json({ error: '优惠券已过期' });
    }

    // 检查最低消费
    const orderAmount = Order_Amount || 0;
    if (orderAmount > 0 && orderAmount < c.Min_Order_Amount) {
      return res.status(400).json({ error: `未达到最低消费 ¥${c.Min_Order_Amount}` });
    }

    // 计算抵扣金额
    let discountAmount = 0;
    if (c.Discount_Type === 'Fixed_Amount') {
      discountAmount = parseFloat(c.Discount_Value);
    } else if (c.Discount_Type === 'Percent_Off') {
      discountAmount = orderAmount * parseFloat(c.Discount_Value);
      if (c.Max_Discount_Cap) discountAmount = Math.min(discountAmount, parseFloat(c.Max_Discount_Cap));
    }
    discountAmount = Math.min(discountAmount, orderAmount || discountAmount);

    // Preview 模式：仅查询验证，不标记 Used（Admin 预览用）
    if (preview) {
      return res.json({
        message: '预览验证成功（未核销）',
        Coupon_ID: c.Coupon_ID,
        Coupon_Name: c.Coupon_Name,
        User_Name: c.Account_Name,
        User_ID: c.User_ID,
        Discount_Type: c.Discount_Type,
        Discount_Value: c.Discount_Value,
        Discount_Amount: discountAmount,
        Applicable_Script_ID: c.Applicable_Script_ID,
        Script_Title: c.Script_Title,
        Is_Redeemed: false,
        Is_Preview: true,
      });
    }

    // Always mark coupon as Used (prevent infinite reuse)
    const transaction = new sql.Transaction(await getPool());
    await transaction.begin();
    try {
      await transaction.request()
        .input('id', sql.BigInt, c.Coupon_ID)
        .query(`UPDATE User_Coupon_Instance SET Coupon_Status = 'Used', Used_At = SYSUTCDATETIME()
                WHERE Coupon_ID = @id`);

      if (Transaction_ID) {
        await transaction.request()
          .input('couponId', sql.BigInt, c.Coupon_ID)
          .input('txnId', sql.BigInt, Transaction_ID)
          .input('amount', sql.Decimal(10, 2), discountAmount)
          .query(`INSERT INTO Discount_Usage_Log (Coupon_ID, Transaction_ID, Discount_Amount)
                  VALUES (@couponId, @txnId, @amount)`);
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    res.json({
      message: '验证成功',
      Coupon_ID: c.Coupon_ID,
      Coupon_Name: c.Coupon_Name,
      User_Name: c.Account_Name,
      User_ID: c.User_ID,
      Discount_Type: c.Discount_Type,
      Discount_Value: c.Discount_Value,
      Discount_Amount: discountAmount,
      Applicable_Script_ID: c.Applicable_Script_ID,
      Script_Title: c.Script_Title,
      Is_Redeemed: !!Transaction_ID,
    });
  } catch (err) {
    console.error('Verify by code error:', err);
    if (err.originalError) return res.status(400).json({ error: err.originalError.message });
    res.status(500).json({ error: '优惠券验证失败' });
  }
});

// GET /api/coupons/usage-log - Admin/Store_Manager 查看核销记录
router.get('/usage-log', authorize(3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const { template_id, from, to } = req.query;
    let query = `SELECT ul.*, c.Template_ID, t.Coupon_Name, pt.Amount AS Payment_Amount,
                        pt.Transaction_Type, a.Account_Name AS User_Name
                 FROM Discount_Usage_Log ul
                 JOIN User_Coupon_Instance c ON c.Coupon_ID = ul.Coupon_ID
                 JOIN Coupon_Template t ON t.Template_ID = c.Template_ID
                 JOIN Payment_Transaction_Table pt ON pt.Transaction_ID = ul.Transaction_ID
                 JOIN Account_Base_Table a ON a.User_ID = c.User_ID
                 WHERE 1=1`;
    const request = pool.request();
    if (template_id) {
      query += ' AND c.Template_ID = @templateId';
      request.input('templateId', sql.Int, parseInt(template_id));
    }
    if (from) {
      query += ' AND ul.Recorded_At >= @from';
      request.input('from', sql.NVarChar, from);
    }
    if (to) {
      query += ' AND ul.Recorded_At <= @to';
      request.input('to', sql.NVarChar, to);
    }
    query += ' ORDER BY ul.Recorded_At DESC';

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('Usage log error:', err);
    res.status(500).json({ error: '获取核销记录失败' });
  }
});

// DELETE /api/coupons/usage-log/:id - Admin/Store_Manager 删除核销记录
router.delete('/usage-log/:id', authorize(3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.BigInt, parseInt(req.params.id))
      .query('DELETE FROM Discount_Usage_Log WHERE Usage_ID = @id');

    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: '核销记录不存在' });
    res.json({ message: '核销记录已删除' });
  } catch (err) {
    console.error('Delete usage log error:', err);
    res.status(500).json({ error: '删除核销记录失败' });
  }
});

module.exports = router;

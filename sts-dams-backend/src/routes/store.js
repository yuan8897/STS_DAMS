const { Router } = require('express');
const { getPool, sql } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const router = Router();
router.use(authenticate);

// GET /api/store/info - 所有登录用户可查看门店信息
router.get('/info', async (req, res) => {
  try {
    const pool = await getPool();
    let result = await pool.request()
      .query(`SELECT Store_ID, Store_Name, Store_Address, Contact_Phone, Contact_Email,
                     Business_Hours, Created_At, Updated_At
              FROM Dim_Store_Info WHERE Store_ID = 1`);

    if (result.recordset.length === 0) {
      // 自动创建默认门店信息
      await pool.request()
        .query(`INSERT INTO Dim_Store_Info (Store_ID, Store_Name, Store_Address, Contact_Phone, Contact_Email)
                VALUES (1, 'STS 剧本杀推理馆', '', '', '')`);
      result = await pool.request()
        .query('SELECT * FROM Dim_Store_Info WHERE Store_ID = 1');
    }

    const store = result.recordset[0];
    res.json({
      name: store.Store_Name,
      address: store.Store_Address || '',
      phone: store.Contact_Phone || '',
      email: store.Contact_Email || '',
      businessHours: store.Business_Hours || '',
      updatedAt: store.Updated_At,
    });
  } catch (err) {
    console.error('Get store info error:', err);
    res.status(500).json({ error: '获取门店信息失败' });
  }
});

// PUT /api/store/info - Admin 更新门店信息
router.put('/info', authorize(3), async (req, res) => {
  try {
    const pool = await getPool();
    const { name, address, phone, email, businessHours } = req.body;

    // 确保记录存在
    await pool.request()
      .query(`IF NOT EXISTS (SELECT 1 FROM Dim_Store_Info WHERE Store_ID = 1)
              INSERT INTO Dim_Store_Info (Store_ID, Store_Name) VALUES (1, 'STS 剧本杀推理馆')`);

    await pool.request()
      .input('name', sql.NVarChar, name || null)
      .input('address', sql.NVarChar, address || null)
      .input('phone', sql.NVarChar, phone || null)
      .input('email', sql.NVarChar, email || null)
      .input('hours', sql.NVarChar, businessHours || null)
      .query(`UPDATE Dim_Store_Info SET
                Store_Name = ISNULL(@name, Store_Name),
                Store_Address = ISNULL(@address, Store_Address),
                Contact_Phone = ISNULL(@phone, Contact_Phone),
                Contact_Email = ISNULL(@email, Contact_Email),
                Business_Hours = ISNULL(@hours, Business_Hours),
                Updated_At = SYSUTCDATETIME()
              WHERE Store_ID = 1`);

    res.json({ message: '门店信息已更新' });
  } catch (err) {
    console.error('Update store info error:', err);
    res.status(500).json({ error: '更新门店信息失败' });
  }
});

module.exports = router;

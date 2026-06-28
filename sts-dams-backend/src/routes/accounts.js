const { Router } = require('express');
const { getPool, sql } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize, allowAdminOrSelf } = require('../middleware/authorize');
const { paginate } = require('../utils/pagination');

const router = Router();
router.use(authenticate);

// GET /api/accounts?page=1&size=50&role=&status=
router.get('/', authorize(3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const { role, status } = req.query;
    let whereClause = 'WHERE Is_Deleted = 0';
    const reqObj = pool.request();
    if (role) { whereClause += ' AND Role_Type = @role'; reqObj.input('role', sql.Int, parseInt(role)); }
    if (status) { whereClause += ' AND Account_Status = @status'; reqObj.input('status', sql.NVarChar, status); }

    const baseQuery = `SELECT User_ID, Account_Name, Contact_Phone, Role_Type, Account_Status,
                              Account_Created_At, Last_Login_At, Is_Deleted
                       FROM Account_Base_Table ${whereClause}`;
    const countQuery = `SELECT COUNT(*) AS total FROM Account_Base_Table ${whereClause}`;

    const result = await paginate({
      req, baseQuery, countQuery, request: reqObj,
      defaultOrder: ' ORDER BY User_ID',
    });
    res.json(result);
  } catch (err) {
    console.error('List accounts error:', err);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// GET /api/accounts/:id
router.get('/:id', allowAdminOrSelf(), async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .query(`SELECT User_ID, Account_Name, Contact_Phone, Role_Type, Account_Status,
                     Account_Created_At, Last_Login_At
              FROM Account_Base_Table WHERE User_ID = @id AND Is_Deleted = 0`);

    if (result.recordset.length === 0) return res.status(404).json({ error: '用户不存在' });
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Get account error:', err);
    res.status(500).json({ error: '获取用户详情失败' });
  }
});

// PUT /api/accounts/:id
router.put('/:id', allowAdminOrSelf(), async (req, res) => {
  try {
    const pool = await getPool();
    const { Contact_Phone } = req.body;
    await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .input('phone', sql.NVarChar, Contact_Phone || null)
      .query(`UPDATE Account_Base_Table SET Contact_Phone = @phone WHERE User_ID = @id`);
    res.json({ message: '更新成功' });
  } catch (err) {
    console.error('Update account error:', err);
    res.status(500).json({ error: '更新失败' });
  }
});

// DELETE /api/accounts/:id —— 软删除
router.delete('/:id', authorize(3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .query(`UPDATE Account_Base_Table SET Is_Deleted = 1, Deleted_At = SYSUTCDATETIME()
              WHERE User_ID = @id`);
    res.json({ message: '已删除' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: '删除失败' });
  }
});

// PUT /api/accounts/:id/status
router.put('/:id/status', authorize(3, 4), async (req, res) => {
  try {
    const { Account_Status } = req.body;
    if (!['Active', 'Locked', 'Disabled'].includes(Account_Status)) {
      return res.status(400).json({ error: '无效的状态值' });
    }
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .input('status', sql.NVarChar, Account_Status)
      .query('UPDATE Account_Base_Table SET Account_Status = @status WHERE User_ID = @id');
    res.json({ message: '状态更新成功' });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: '状态更新失败' });
  }
});

module.exports = router;

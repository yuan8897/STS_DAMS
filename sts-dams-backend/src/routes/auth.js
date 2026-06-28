const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool, sql } = require('../config/db');
const { authenticate } = require('../middleware/auth');
require('dotenv').config();

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: 用户注册
 *     description: 注册新账户（Player 或 DM 角色）。Admin 和 Store_Manager 需管理员创建。
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [Account_Name, Password, Role_Type]
 *             properties:
 *               Account_Name:
 *                 type: string
 *                 example: player_new
 *               Password:
 *                 type: string
 *                 example: "123456"
 *               Role_Type:
 *                 type: integer
 *                 description: 1=Player, 2=DM
 *                 example: 1
 *               Contact_Phone:
 *                 type: string
 *                 example: "+8613800000009"
 *               DM_Stage_Name:
 *                 type: string
 *                 description: DM 艺名（Role_Type=2 时可选）
 *     responses:
 *       201:
 *         description: 注册成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 User_ID:
 *                   type: integer
 *                 token:
 *                   type: string
 *       400:
 *         description: 参数错误
 *       409:
 *         description: 账户名已被注册
 */
router.post('/register', async (req, res) => {
  try {
    const { Account_Name, Password, Role_Type } = req.body;

    if (!Account_Name || !Password) {
      return res.status(400).json({ error: '账户名和密码为必填项' });
    }
    if (Password.length < 8) {
      return res.status(400).json({ error: '密码长度不能少于 8 位' });
    }
    if (Password.length > 128) {
      return res.status(400).json({ error: '密码长度不能超过 128 位' });
    }
    // 密码复杂度：至少包含字母和数字
    if (!/[a-zA-Z]/.test(Password) || !/[0-9]/.test(Password)) {
      return res.status(400).json({ error: '密码必须同时包含字母和数字' });
    }
    if (![1, 2, 3, 4].includes(Role_Type)) {
      return res.status(400).json({ error: '无效的角色类型，可选: 1=Player, 2=DM, 3=Admin, 4=Store_Manager' });
    }
    if (Role_Type === 3) {
      const { Invite_Code } = req.body;
      const validCode = process.env.ADMIN_INVITE_CODE || 'sts-dams-admin-2026';
      if (!Invite_Code || Invite_Code !== validCode) {
        return res.status(400).json({ error: '邀请码无效，管理员注册需要有效邀请码' });
      }
    }
    if (Role_Type === 4) {
      const { Invite_Code } = req.body;
      const validCode = process.env.STORE_MANAGER_INVITE_CODE || 'sts-dams-store-2026';
      if (!Invite_Code || Invite_Code !== validCode) {
        return res.status(400).json({ error: '邀请码无效，门店管理员注册需要有效邀请码' });
      }
    }

    const pool = await getPool();

    // 检查唯一性
    const existing = await pool.request()
      .input('name', sql.NVarChar, Account_Name)
      .query('SELECT 1 FROM Account_Base_Table WHERE Account_Name = @name');
    if (existing.recordset.length > 0) {
      return res.status(409).json({ error: '账户名已被注册' });
    }

    const hash = bcrypt.hashSync(Password, 10);
    const phone = req.body.Contact_Phone || null;

    const result = await pool.request()
      .input('name', sql.NVarChar, Account_Name)
      .input('hash', sql.VarBinary, hash)
      .input('phone', sql.NVarChar, phone)
      .input('role', sql.TinyInt, Role_Type)
      .query(`INSERT INTO Account_Base_Table (Account_Name, Password_Hash, Contact_Phone, Role_Type, Account_Status)
              OUTPUT INSERTED.User_ID
              VALUES (@name, @hash, @phone, @role, 'Active')`);

    const userId = result.recordset[0].User_ID;

    // 若注册为 DM，创建 DM_Profile
    let dmUserId = null;
    let dmStageName = null;
    if (Role_Type === 2) {
      const stageName = req.body.DM_Stage_Name || Account_Name;
      dmUserId = userId;
      dmStageName = stageName;
      await pool.request()
        .input('uid', sql.Int, userId)
        .input('stage', sql.NVarChar, stageName)
        .query(`INSERT INTO DM_Profile_Table (DM_User_ID, DM_Stage_Name, Base_Per_Session_Wage, Employment_Status, Hire_Date)
                VALUES (@uid, @stage, 100.00, 'Probation', CAST(GETDATE() AS DATE))`);
    }

    const token = jwt.sign(
      { User_ID: userId, Account_Name, Role_Type, DM_User_ID: dmUserId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({ User_ID: userId, Role_Type, DM_User_ID: dmUserId, DM_Stage_Name: dmStageName, token });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: '注册失败' });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: 用户登录
 *     description: 使用账户名和密码登录，返回 JWT Token 和用户信息。
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: 登录成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: 账户名或密码错误
 *       403:
 *         description: 账户被封禁或已注销
 */
// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { Account_Name, Password } = req.body;
    if (!Account_Name || !Password) {
      return res.status(400).json({ error: '账户名和密码为必填项' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('name', sql.NVarChar, Account_Name)
      .query(`SELECT User_ID, Account_Name, Password_Hash, Role_Type, Account_Status
              FROM Account_Base_Table
              WHERE Account_Name = @name AND Is_Deleted = 0`);

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: '账户名或密码错误' });
    }

    const user = result.recordset[0];

    if (user.Account_Status === 'Locked') {
      return res.status(403).json({ error: '账户已被封禁' });
    }
    if (user.Account_Status === 'Disabled') {
      return res.status(403).json({ error: '账户已注销' });
    }

    // 兼容 bcrypt 和 SHA-256（含 per-user salt）两种哈希
    // SHA-256 = 32 bytes, bcrypt ≈ 60 bytes
    let valid = false;
    if (user.Password_Hash.length <= 32) {
      // SHA-256 with per-user salt: hash(concat(username, ':', password))
      const saltedInput = user.Account_Name + ':' + Password;
      valid = Buffer.from(user.Password_Hash).toString('hex')
        === require('crypto').createHash('sha256').update(saltedInput).digest('hex');
    } else {
      valid = bcrypt.compareSync(Password, user.Password_Hash.toString());
    }

    if (!valid) {
      return res.status(401).json({ error: '账户名或密码错误' });
    }

    // 更新最后登录时间
    await pool.request()
      .input('uid', sql.Int, user.User_ID)
      .query(`UPDATE Account_Base_Table SET Last_Login_At = SYSUTCDATETIME()
              WHERE User_ID = @uid`);

    // 若为 DM，取 DM_User_ID 和 DM_Stage_Name
    let dmUserId = null;
    let dmStageName = null;
    if (user.Role_Type === 2) {
      const dm = await pool.request()
        .input('uid', sql.Int, user.User_ID)
        .query('SELECT DM_User_ID, DM_Stage_Name FROM DM_Profile_Table WHERE DM_User_ID = @uid');
      if (dm.recordset.length > 0) {
        dmUserId = dm.recordset[0].DM_User_ID;
        dmStageName = dm.recordset[0].DM_Stage_Name;
      }
    }

    const token = jwt.sign(
      { User_ID: user.User_ID, Account_Name: user.Account_Name, Role_Type: user.Role_Type, DM_User_ID: dmUserId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      User_ID: user.User_ID,
      Account_Name: user.Account_Name,
      Role_Type: user.Role_Type,
      DM_User_ID: dmUserId,
      DM_Stage_Name: dmStageName,
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: '登录失败' });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: 获取当前用户信息
 *     description: 返回当前登录用户的详细信息（含 DM 档案，如适用）。
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 用户信息
 *       401:
 *         description: 未认证
 *       404:
 *         description: 用户不存在
 */
// GET /api/auth/me —— 获取当前用户信息
router.get('/me', authenticate, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('uid', sql.Int, req.user.User_ID)
      .query(`SELECT User_ID, Account_Name, Role_Type, Account_Status, Account_Created_At, Last_Login_At
              FROM Account_Base_Table WHERE User_ID = @uid AND Is_Deleted = 0`);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    const user = result.recordset[0];

    let dmInfo = null;
    if (user.Role_Type === 2) {
      const dm = await pool.request()
        .input('uid', sql.Int, user.User_ID)
        .query('SELECT DM_Stage_Name, Employment_Status, Hire_Date FROM DM_Profile_Table WHERE DM_User_ID = @uid');
      if (dm.recordset.length > 0) dmInfo = dm.recordset[0];
    }

    res.json({ ...user, DM_Info: dmInfo });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

module.exports = router;

const { Router } = require('express');
const { getPool, sql } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const router = Router();
router.use(authenticate);

// GET /api/notifications - 当前用户的通知列表
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const { unread_only } = req.query;

    let query = `SELECT * FROM User_Notification
                 WHERE Recipient_User_ID = @userId`;
    if (unread_only === 'true') query += ' AND Is_Read = 0';
    query += ' ORDER BY Created_At DESC';

    const result = await pool.request()
      .input('userId', sql.Int, req.user.User_ID)
      .query(query);

    res.json(result.recordset);
  } catch (err) {
    console.error('List notifications error:', err);
    res.status(500).json({ error: '获取通知列表失败' });
  }
});

// GET /api/notifications/unread-count - 未读通知数量
router.get('/unread-count', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.Int, req.user.User_ID)
      .query(`SELECT COUNT(*) AS Unread_Count FROM User_Notification
              WHERE Recipient_User_ID = @userId AND Is_Read = 0`);

    res.json({ Unread_Count: result.recordset[0].Unread_Count });
  } catch (err) {
    console.error('Unread count error:', err);
    res.status(500).json({ error: '获取未读数量失败' });
  }
});

// PUT /api/notifications/:id/mark-read - 标记单条已读
router.put('/:id/mark-read', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.BigInt, parseInt(req.params.id))
      .input('userId', sql.Int, req.user.User_ID)
      .query(`UPDATE User_Notification SET Is_Read = 1, Read_At = SYSUTCDATETIME()
              WHERE Notification_ID = @id AND Recipient_User_ID = @userId`);

    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: '通知不存在' });
    res.json({ message: '已标记为已读' });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: '标记已读失败' });
  }
});

// PUT /api/notifications/mark-all-read - 全部标记已读
router.put('/mark-all-read', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.Int, req.user.User_ID)
      .query(`UPDATE User_Notification SET Is_Read = 1, Read_At = SYSUTCDATETIME()
              WHERE Recipient_User_ID = @userId AND Is_Read = 0`);

    res.json({ message: `已标记 ${result.rowsAffected[0]} 条通知为已读` });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: '标记全部已读失败' });
  }
});

// POST /api/notifications/send - Admin/Store_Manager 发送通知
router.post('/send', authorize(3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const { Recipient_User_IDs, Role_Type, Notification_Type, Title, Content, Related_Entity_Type, Related_Entity_ID } = req.body;

    if (!Title) return res.status(400).json({ error: '通知标题不能为空' });

    const validTypes = ['Session_Reminder', 'Payment_Confirm', 'Coupon_Issued', 'Coupon_Expiring',
                        'System_Announce', 'Low_Stock_Alert', 'Review_Request'];
    const type = validTypes.includes(Notification_Type) ? Notification_Type : 'System_Announce';

    let targetUsers = [];

    if (Recipient_User_IDs && Array.isArray(Recipient_User_IDs)) {
      targetUsers = Recipient_User_IDs;
    } else if (Role_Type) {
      const users = await pool.request()
        .input('role', sql.TinyInt, Role_Type)
        .query('SELECT User_ID FROM Account_Base_Table WHERE Role_Type = @role AND Is_Deleted = 0');
      targetUsers = users.recordset.map(u => u.User_ID);
    } else {
      // 全员
      const users = await pool.request()
        .query('SELECT User_ID FROM Account_Base_Table WHERE Is_Deleted = 0');
      targetUsers = users.recordset.map(u => u.User_ID);
    }

    if (targetUsers.length === 0) {
      return res.status(400).json({ error: '没有符合条件的接收用户' });
    }

    // 批量 INSERT —— 使用 Table-Valued Parameter 或 UNION ALL 批量插入
    // mssql 库支持构建多行 VALUES 的方式：逐个构建 request 参数
    // 这里使用批量方式：构建 VALUES 子句，每行用参数化变量
    const batchSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < targetUsers.length; i += batchSize) {
      const batch = targetUsers.slice(i, i + batchSize);
      const request = pool.request();

      // 构建参数化批量 INSERT
      const valuesParts = [];
      batch.forEach((userId, idx) => {
        const suffix = `_${i}_${idx}`;
        request.input(`userId${suffix}`, sql.Int, userId);
        request.input(`type${suffix}`, sql.NVarChar, type);
        request.input(`title${suffix}`, sql.NVarChar, Title);
        request.input(`content${suffix}`, sql.NVarChar, Content || null);
        request.input(`entityType${suffix}`, sql.NVarChar, Related_Entity_Type || null);
        request.input(`entityId${suffix}`, sql.NVarChar, Related_Entity_ID || null);
        valuesParts.push(`(@userId${suffix}, @type${suffix}, @title${suffix}, @content${suffix}, @entityType${suffix}, @entityId${suffix})`);
      });

      await request.query(`INSERT INTO User_Notification (Recipient_User_ID, Notification_Type, Title, Content,
                Related_Entity_Type, Related_Entity_ID)
                VALUES ${valuesParts.join(', ')}`);
      insertedCount += batch.length;
    }

    // WebSocket 实时推送通知
    try {
      const { pushToUser } = require('../wsServer');
      for (const userId of targetUsers) {
        pushToUser(userId, 'new_notification', {
          title: Title,
          content: Content || '',
          type,
          related_entity_type: Related_Entity_Type || null,
          related_entity_id: Related_Entity_ID || null,
        });
      }
    } catch (_) { /* WebSocket 未就绪时静默跳过 */ }

    res.status(201).json({ message: `通知已发送至 ${insertedCount} 位用户` });
  } catch (err) {
    console.error('Send notification error:', err);
    if (err.originalError) return res.status(400).json({ error: err.originalError.message });
    res.status(500).json({ error: '发送通知失败' });
  }
});

module.exports = router;

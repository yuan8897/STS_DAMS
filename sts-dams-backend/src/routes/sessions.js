const { Router } = require('express');
const { getPool, sql, setSessionContext } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/sessions:
 *   get:
 *     summary: 获取场次列表
 *     description: 查询场次列表，支持按状态/日期/房间/DM 筛选。
 *     tags: [Sessions]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Matching, Locked_Ready, In_Progress, Completed, Aborted]
 *         description: 场次状态
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: 场次日期 (YYYY-MM-DD)
 *       - in: query
 *         name: room_id
 *         schema:
 *           type: integer
 *         description: 房间 ID
 *       - in: query
 *         name: dm_id
 *         schema:
 *           type: integer
 *         description: DM 用户 ID
 *     responses:
 *       200:
 *         description: 场次列表
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Session'
 */
// GET /api/sessions
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const { status, date, room_id, dm_id } = req.query;
    let query = `SELECT s.*, sd.Script_Title, r.Room_Name, dm.DM_Stage_Name,
                        pcount.Registered_Count
                 FROM Fact_Session_Schedule s
                 JOIN Asset_Script_Copy_Table sc ON sc.Copy_ID = s.Copy_ID
                 JOIN Dim_Script_Dictionary sd ON sd.Script_ID = sc.Script_ID
                 JOIN Dim_Store_Room r ON r.Room_ID = s.Room_ID
                 JOIN DM_Profile_Table dm ON dm.DM_User_ID = s.DM_User_ID
                 LEFT JOIN vw_Session_Player_Count pcount ON pcount.Session_ID = s.Session_ID
                 WHERE 1=1`;
    const request = pool.request();
    if (status) {
      query += ' AND s.Session_Status = @status';
      request.input('status', sql.NVarChar, status);
    }
    if (date) {
      query += ' AND CAST(s.Scheduled_Start_Time AS DATE) = @date';
      request.input('date', sql.NVarChar, date);
    }
    if (room_id) {
      query += ' AND s.Room_ID = @roomId';
      request.input('roomId', sql.Int, parseInt(room_id));
    }
    if (dm_id) {
      query += ' AND s.DM_User_ID = @dmId';
      request.input('dmId', sql.Int, parseInt(dm_id));
    }

    query += ' ORDER BY s.Scheduled_Start_Time';

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('List sessions error:', err);
    res.status(500).json({ error: '获取场次列表失败' });
  }
});

/**
 * @swagger
 * /api/sessions/matching:
 *   get:
 *     summary: 拼车大厅
 *     description: 获取可加入的场次列表（Matching + Locked_Ready 状态），玩家端大厅使用。
 *     tags: [Sessions]
 *     parameters:
 *       - in: query
 *         name: genre
 *         schema:
 *           type: integer
 *         description: 题材 ID 筛选
 *     responses:
 *       200:
 *         description: 拼车场次列表
 */
// GET /api/sessions/matching —— 拼车大厅（含 Matching + Locked_Ready）
router.get('/matching', async (req, res) => {
  try {
    const pool = await getPool();
    const { genre } = req.query;
    let query = `SELECT s.*, sd.Script_Title, g.Genre_Name, r.Room_Name, dm.DM_Stage_Name,
                        pcount.Registered_Count, sd.Max_Allowed_Players, sd.Min_Required_Players,
                        sd.Primary_Genre,
                        curReg.Registration_ID AS Current_User_Registration_ID
                 FROM Fact_Session_Schedule s
                 JOIN Asset_Script_Copy_Table sc ON sc.Copy_ID = s.Copy_ID
                 JOIN Dim_Script_Dictionary sd ON sd.Script_ID = sc.Script_ID
                 JOIN Dim_Genre_Lookup g ON g.Genre_ID = sd.Primary_Genre
                 JOIN Dim_Store_Room r ON r.Room_ID = s.Room_ID
                 JOIN DM_Profile_Table dm ON dm.DM_User_ID = s.DM_User_ID
                 LEFT JOIN vw_Session_Player_Count pcount ON pcount.Session_ID = s.Session_ID
                 LEFT JOIN Bridge_Player_Registration curReg
                     ON curReg.Session_ID = s.Session_ID AND curReg.Player_User_ID = @userId
                 WHERE s.Session_Status IN ('Matching', 'Locked_Ready') AND sd.Is_Retired = 0`;
    const request = pool.request();
    request.input('userId', sql.Int, req.user.User_ID);
    if (genre) {
      query += ' AND sd.Primary_Genre = @genre';
      request.input('genre', sql.Int, parseInt(genre));
    }
    query += ' ORDER BY s.Scheduled_Start_Time';

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('Matching list error:', err);
    res.status(500).json({ error: '获取拼车列表失败' });
  }
});

// GET /api/sessions/grid —— 时空大盘
router.get('/grid', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date 参数必填' });
    const pool = await getPool();

    // 获取所有房间
    const rooms = await pool.request().query('SELECT * FROM Dim_Store_Room WHERE Room_Operating_Status = \'Operational\' ORDER BY Room_ID');

    // 获取指定日期场次
    const sessions = await pool.request()
      .input('date', sql.NVarChar, date)
      .query(`SELECT s.*, sd.Script_Title, dm.DM_Stage_Name,
                     pcount.Registered_Count, sd.Max_Allowed_Players
              FROM Fact_Session_Schedule s
              JOIN Asset_Script_Copy_Table sc ON sc.Copy_ID = s.Copy_ID
              JOIN Dim_Script_Dictionary sd ON sd.Script_ID = sc.Script_ID
              JOIN DM_Profile_Table dm ON dm.DM_User_ID = s.DM_User_ID
              LEFT JOIN vw_Session_Player_Count pcount ON pcount.Session_ID = s.Session_ID
              WHERE CAST(s.Scheduled_Start_Time AS DATE) = @date
                AND s.Session_Status NOT IN ('Aborted')
              ORDER BY s.Room_ID, s.Scheduled_Start_Time`);

    const grid = rooms.recordset.map(room => ({
      Room_ID: room.Room_ID,
      Room_Name: room.Room_Name,
      Room_Max_Capacity: room.Room_Max_Capacity,
      sessions: sessions.recordset
        .filter(s => s.Room_ID === room.Room_ID)
        .map(s => ({
          Session_ID: s.Session_ID,
          Script_Title: s.Script_Title,
          DM_Stage_Name: s.DM_Stage_Name,
          Start: s.Scheduled_Start_Time,
          End: s.Scheduled_End_Time,
          Status: s.Session_Status,
          Player_Count: s.Registered_Count || 0,
          Max_Players: s.Max_Allowed_Players,
          Frozen_Per_Head_Price: s.Frozen_Per_Head_Price,
        })),
    }));

    res.json({ date, rooms: grid });
  } catch (err) {
    console.error('Grid error:', err);
    res.status(500).json({ error: '获取大盘数据失败' });
  }
});

// GET /api/sessions/:id
router.get('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const session = await pool.request()
      .input('id', sql.BigInt, parseInt(req.params.id))
      .query(`SELECT s.*, sd.Script_Title, sd.Min_Required_Players, sd.Max_Allowed_Players,
                     sd.Estimated_Duration, g.Genre_Name, r.Room_Name, r.Room_Max_Capacity,
                     dm.DM_Stage_Name, sc.Copy_Asset_Barcode,
                     pcount.Registered_Count
              FROM Fact_Session_Schedule s
              JOIN Asset_Script_Copy_Table sc ON sc.Copy_ID = s.Copy_ID
              JOIN Dim_Script_Dictionary sd ON sd.Script_ID = sc.Script_ID
              JOIN Dim_Genre_Lookup g ON g.Genre_ID = sd.Primary_Genre
              JOIN Dim_Store_Room r ON r.Room_ID = s.Room_ID
              JOIN DM_Profile_Table dm ON dm.DM_User_ID = s.DM_User_ID
              LEFT JOIN vw_Session_Player_Count pcount ON pcount.Session_ID = s.Session_ID
              WHERE s.Session_ID = @id`);

    if (session.recordset.length === 0) return res.status(404).json({ error: '场次不存在' });

    // 参团玩家列表
    const players = await pool.request()
      .input('id', sql.BigInt, parseInt(req.params.id))
      .query(`SELECT reg.*, a.Account_Name, rl.Role_Name, rl.Gender_Restriction
              FROM Bridge_Player_Registration reg
              JOIN Account_Base_Table a ON a.User_ID = reg.Player_User_ID
              LEFT JOIN Script_Role_Definition_Table rl ON rl.Role_ID = reg.Role_ID
              WHERE reg.Session_ID = @id
              ORDER BY reg.Joined_At`);

    // 剧本角色列表（含占用状态）
    const scriptId = await getScriptId(pool, session.recordset[0].Copy_ID);
    const roles = await pool.request()
      .input('id', sql.BigInt, parseInt(req.params.id))
      .query(`SELECT rl.*, reg.Player_User_ID, a.Account_Name AS Occupied_By
              FROM Script_Role_Definition_Table rl
              LEFT JOIN Bridge_Player_Registration reg
                ON reg.Role_ID = rl.Role_ID AND reg.Session_ID = @id
              LEFT JOIN Account_Base_Table a ON a.User_ID = reg.Player_User_ID
              WHERE rl.Script_ID = (
                SELECT sc.Script_ID FROM Asset_Script_Copy_Table sc
                JOIN Fact_Session_Schedule fs ON fs.Copy_ID = sc.Copy_ID
                WHERE fs.Session_ID = @id
              )
              ORDER BY rl.Role_ID`);

    res.json({
      ...session.recordset[0],
      Players: players.recordset,
      Roles: roles.recordset,
    });
  } catch (err) {
    console.error('Get session error:', err);
    res.status(500).json({ error: '获取场次详情失败' });
  }
});

async function getScriptId(pool, copyId) {
  const r = await pool.request()
    .input('copyId', sql.BigInt, copyId)
    .query('SELECT Script_ID FROM Asset_Script_Copy_Table WHERE Copy_ID = @copyId');
  return r.recordset[0]?.Script_ID;
}

// POST /api/sessions —— 创车（DM/Admin/Store_Manager 可创建）
router.post('/', authorize(2, 3, 4), async (req, res) => {
  try {
    let { Copy_ID, Script_ID, Room_ID, DM_User_ID, Scheduled_Start_Time, Scheduled_End_Time, Frozen_Per_Head_Price } = req.body;

    // 必须提供 Script_ID 或 Copy_ID
    if (!Script_ID && !Copy_ID) {
      return res.status(400).json({ error: '缺少必填参数：Script_ID 或 Copy_ID' });
    }
    if (!Room_ID || !DM_User_ID || !Scheduled_Start_Time || !Scheduled_End_Time) {
      return res.status(400).json({ error: '缺少必填参数' });
    }

    const pool = await getPool();

    // 如果提供了 Script_ID，自动解析/创建 Copy_ID
    if (!Copy_ID && Script_ID) {
      // 查找该剧本第一个非 Scrapped 副本
      const copyResult = await pool.request()
        .input('scriptId', sql.Int, Script_ID)
        .query(`SELECT TOP 1 Copy_ID FROM Asset_Script_Copy_Table
                WHERE Script_ID = @scriptId AND Asset_Condition <> 'Scrapped'
                ORDER BY Copy_ID`);

      if (copyResult.recordset.length > 0) {
        Copy_ID = copyResult.recordset[0].Copy_ID;
      } else {
        // 无可用副本 → 自动创建
        const barcode = `AUTO-S${Script_ID}-${Date.now().toString(36).toUpperCase()}`;
        const newCopy = await pool.request()
          .input('scriptId', sql.Int, Script_ID)
          .input('barcode', sql.NVarChar, barcode)
          .query(`INSERT INTO Asset_Script_Copy_Table
                  (Copy_Asset_Barcode, Script_ID, Authorization_Type, Asset_Condition, Purchase_Date)
                  OUTPUT INSERTED.Copy_ID
                  VALUES (@barcode, @scriptId, 'Boxed', 'Perfect', CAST(SYSDATETIME() AS DATE))`);
        Copy_ID = newCopy.recordset[0].Copy_ID;
      }
    }

    // ============ 防线 1：SNAPSHOT 快照预检 ============
    const transaction1 = new sql.Transaction(pool);
    await transaction1.begin(sql.ISOLATION_LEVEL.SNAPSHOT);

    const conflictRoom = await transaction1.request()
      .input('room', sql.Int, Room_ID)
      .input('start', sql.DateTime2, Scheduled_Start_Time)
      .input('end', sql.DateTime2, Scheduled_End_Time)
      .query(`SELECT Session_ID, Scheduled_Start_Time, Scheduled_End_Time, Session_Status
              FROM Fact_Session_Schedule WITH (READCOMMITTED)
              WHERE Room_ID = @room
                AND Scheduled_Start_Time < @end
                AND Scheduled_End_Time > @start
                AND Session_Status <> 'Aborted' AND Session_Status <> 'Completed'`);

    if (conflictRoom.recordset.length > 0) {
      await transaction1.commit();
      return res.status(409).json({
        error: '时空冲突',
        detail: '该房间在所选时段已被占用',
        conflicts: conflictRoom.recordset,
      });
    }

    const conflictDm = await transaction1.request()
      .input('dm', sql.Int, DM_User_ID)
      .input('start', sql.DateTime2, Scheduled_Start_Time)
      .input('end', sql.DateTime2, Scheduled_End_Time)
      .query(`SELECT Session_ID, Scheduled_Start_Time, Scheduled_End_Time, Session_Status
              FROM Fact_Session_Schedule WITH (READCOMMITTED)
              WHERE DM_User_ID = @dm
                AND Scheduled_Start_Time < @end
                AND Scheduled_End_Time > @start
                AND Session_Status <> 'Aborted' AND Session_Status <> 'Completed'`);

    await transaction1.commit();

    if (conflictDm.recordset.length > 0) {
      return res.status(409).json({
        error: '时空冲突',
        detail: '该 DM 在所选时段已被占用',
        conflicts: conflictDm.recordset,
      });
    }

    // ============ 防线 2 + 3：READ_COMMITTED_SNAPSHOT 写事务 + 触发器自动校验 ============
    const transaction2 = new sql.Transaction(pool);
    await transaction2.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

    // 锁定资源行
    await transaction2.request()
      .input('room', sql.Int, Room_ID)
      .query('SELECT Room_ID FROM Dim_Store_Room WITH (UPDLOCK, ROWLOCK) WHERE Room_ID = @room');

    await transaction2.request()
      .input('dm', sql.Int, DM_User_ID)
      .query('SELECT DM_User_ID FROM DM_Profile_Table WITH (UPDLOCK, ROWLOCK) WHERE DM_User_ID = @dm');

    await transaction2.request()
      .input('copy', sql.BigInt, Copy_ID)
      .query('SELECT Copy_ID FROM Asset_Script_Copy_Table WITH (UPDLOCK, ROWLOCK) WHERE Copy_ID = @copy');

    // 复检冲突
    const recheck = await transaction2.request()
      .input('room', sql.Int, Room_ID)
      .input('dm', sql.Int, DM_User_ID)
      .input('start', sql.DateTime2, Scheduled_Start_Time)
      .input('end', sql.DateTime2, Scheduled_End_Time)
      .query(`SELECT Session_ID FROM Fact_Session_Schedule
              WHERE (Room_ID = @room OR DM_User_ID = @dm)
                AND Scheduled_Start_Time < @end
                AND Scheduled_End_Time > @start
                AND Session_Status <> 'Aborted' AND Session_Status <> 'Completed'`);

    if (recheck.recordset.length > 0) {
      await transaction2.rollback();
      return res.status(409).json({ error: '时空冲突：并发操作导致冲突，请重试' });
    }

    // INSERT —— 触发器 1~5 在此自动执行
    // 使用 OUTPUT INTO 表变量 (有触发器时 OUTPUT 必须含 INTO 子句)
    const insertResult = await transaction2.request()
      .input('storeId', sql.Int, req.storeId)
      .input('copy', sql.BigInt, Copy_ID)
      .input('room', sql.Int, Room_ID)
      .input('dm', sql.Int, DM_User_ID)
      .input('start', sql.DateTime2, Scheduled_Start_Time)
      .input('end', sql.DateTime2, Scheduled_End_Time)
      .input('price', sql.Decimal(10, 2), Frozen_Per_Head_Price || 0)
      .input('creator', sql.Int, req.user.User_ID)
      .query(`DECLARE @inserted TABLE (Session_ID BIGINT);
              INSERT INTO Fact_Session_Schedule
              (Store_ID, Copy_ID, Room_ID, DM_User_ID, Scheduled_Start_Time, Scheduled_End_Time,
               Session_Status, Frozen_Per_Head_Price, Created_By_User_ID)
              OUTPUT INSERTED.Session_ID INTO @inserted
              VALUES (@storeId, @copy, @room, @dm, @start, @end, 'Matching', @price, @creator);
              SELECT Session_ID FROM @inserted;`);

    await transaction2.commit();
    const sessionId = insertResult.recordset[0].Session_ID;

    res.status(201).json({ Session_ID: sessionId, message: '场次创建成功' });
  } catch (err) {
    console.error('Create session error:', {
      message: err.message,
      precedingErrors: err.precedingErrors?.map(e => e.message),
      originalError: err.originalError?.message,
      code: err.code,
    });
    // mssql 将触发器 RAISERROR 放在 precedingErrors[0]，
    // 主错误 (err.message) 永远是 SQL Server 的 "The transaction ended in the trigger"
    const triggerMsg = err.precedingErrors?.find(e =>
      /时空冲突|排班冲突|能力不足|容量不足|在职状态异常/.test(e.message)
    )?.message;
    const msg = triggerMsg
      || err.precedingErrors?.[0]?.message
      || err.originalError?.precedingErrors?.[0]?.message
      || err.originalError?.message
      || err.message
      || '场次创建失败';
    const isTriggerError = /时空冲突|排班冲突|能力不足|容量不足|在职状态异常/.test(msg);
    if (err.precedingErrors?.length || err.originalError || isTriggerError) {
      return res.status(409).json({ error: msg });
    }
    res.status(500).json({ error: '场次创建失败' });
  }
});

// PUT /api/sessions/:id/status —— 状态流转（DM/Admin/Store_Manager 可操作）
router.put('/:id/status', authorize(2, 3, 4), async (req, res) => {
  try {
    const { Session_Status } = req.body;
    const validTransitions = {
      'Matching': ['Locked_Ready', 'Aborted'],
      'Locked_Ready': ['In_Progress', 'Aborted'],
      'In_Progress': ['Completed', 'Aborted'],
    };

    const pool = await getPool();
    const current = await pool.request()
      .input('id', sql.BigInt, parseInt(req.params.id))
      .query('SELECT Session_Status, DM_User_ID FROM Fact_Session_Schedule WHERE Session_ID = @id');

    if (current.recordset.length === 0) return res.status(404).json({ error: '场次不存在' });

    // DM 仅能操作自己的场次
    if (req.user.Role_Type === 2 && current.recordset[0].DM_User_ID !== req.user.User_ID) {
      return res.status(403).json({ error: '只能操作自己的场次' });
    }

    const curStatus = current.recordset[0].Session_Status;
    if (!validTransitions[curStatus]?.includes(Session_Status)) {
      return res.status(400).json({ error: `不允许从 ${curStatus} 转换到 ${Session_Status}` });
    }

    // 锁车前校验：所有玩家已选角 + 满足最低人数
    if (Session_Status === 'Locked_Ready') {
      const checkResult = await pool.request()
        .input('id', sql.BigInt, parseInt(req.params.id))
        .query(`SELECT COUNT(*) AS total,
                       SUM(CASE WHEN Role_ID IS NOT NULL THEN 1 ELSE 0 END) AS with_role
                FROM Bridge_Player_Registration WHERE Session_ID = @id`);
      const stats = checkResult.recordset[0];

      const script = await pool.request()
        .input('id', sql.BigInt, parseInt(req.params.id))
        .query(`SELECT sd.Min_Required_Players
                FROM Fact_Session_Schedule s
                JOIN Asset_Script_Copy_Table sc ON sc.Copy_ID = s.Copy_ID
                JOIN Dim_Script_Dictionary sd ON sd.Script_ID = sc.Script_ID
                WHERE s.Session_ID = @id`);
      const minPlayers = script.recordset[0]?.Min_Required_Players || 0;

      if (stats.total < minPlayers) {
        return res.status(400).json({ error: `参团人数(${stats.total})未达最低要求(${minPlayers})` });
      }
      if (stats.with_role < stats.total) {
        return res.status(400).json({ error: '尚有玩家未选定角色，无法锁车' });
      }
    }

    const updateRequest = pool.request();
    await setSessionContext(updateRequest, req.user.User_ID, req.ip);
    await updateRequest
      .input('id', sql.BigInt, parseInt(req.params.id))
      .input('status', sql.NVarChar, Session_Status)
      .query('UPDATE Fact_Session_Schedule SET Session_Status = @status WHERE Session_ID = @id');

    res.json({ message: `场次状态已更新为 ${Session_Status}` });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: '状态更新失败' });
  }
});

// PUT /api/sessions/:id/cancel —— DM可取消自己的场次，Admin/Store_Manager可取消任意场次
router.put('/:id/cancel', authorize(2, 3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    // DM 仅能取消自己的场次
    if (req.user.Role_Type === 2) {
      const check = await pool.request()
        .input('id', sql.BigInt, parseInt(req.params.id))
        .input('dmId', sql.Int, req.user.User_ID)
        .query('SELECT DM_User_ID FROM Fact_Session_Schedule WHERE Session_ID = @id');
      if (check.recordset.length === 0) return res.status(404).json({ error: '场次不存在' });
      if (check.recordset[0].DM_User_ID !== req.user.User_ID) {
        return res.status(403).json({ error: '只能取消自己的场次' });
      }
    }
    const cancelRequest = pool.request();
    await setSessionContext(cancelRequest, req.user.User_ID, req.ip);
    await cancelRequest
      .input('id', sql.BigInt, parseInt(req.params.id))
      .query("UPDATE Fact_Session_Schedule SET Session_Status = 'Aborted' WHERE Session_ID = @id AND Session_Status <> 'Completed'");
    res.json({ message: '场次已取消' });
  } catch (err) {
    console.error('Cancel error:', err);
    res.status(500).json({ error: '取消场次失败' });
  }
});

// POST /api/sessions/:id/join —— 仅玩家可参团
router.post('/:id/join', authorize(1), async (req, res) => {
  try {
    const pool = await getPool();
    const sessionId = parseInt(req.params.id);

    // 检查场次状态
    const session = await pool.request()
      .input('id', sql.BigInt, sessionId)
      .query(`SELECT s.Session_Status, sd.Max_Allowed_Players
              FROM Fact_Session_Schedule s
              JOIN Asset_Script_Copy_Table sc ON sc.Copy_ID = s.Copy_ID
              JOIN Dim_Script_Dictionary sd ON sd.Script_ID = sc.Script_ID
              WHERE s.Session_ID = @id`);

    if (session.recordset.length === 0) return res.status(404).json({ error: '场次不存在' });
    if (session.recordset[0].Session_Status !== 'Matching') {
      return res.status(400).json({ error: '场次已满员或已开始，无法参团' });
    }

    // 检查人数
    const count = await pool.request()
      .input('id', sql.BigInt, sessionId)
      .query('SELECT Registered_Count FROM vw_Session_Player_Count WHERE Session_ID = @id');
    const currentCount = count.recordset[0]?.Registered_Count || 0;
    if (currentCount >= session.recordset[0].Max_Allowed_Players) {
      return res.status(400).json({ error: '场次已满员' });
    }

    // 插入参团
    const result = await pool.request()
      .input('session', sql.BigInt, sessionId)
      .input('player', sql.Int, req.user.User_ID)
      .query(`INSERT INTO Bridge_Player_Registration (Session_ID, Player_User_ID, Cached_Payment_Status)
              OUTPUT INSERTED.Registration_ID
              VALUES (@session, @player, 'Unpaid')`);

    res.status(201).json({ Registration_ID: result.recordset[0].Registration_ID, message: '参团成功' });
  } catch (err) {
    if (err.originalError?.message?.includes('UQ_Player_Session')) {
      return res.status(409).json({ error: '您已在该场次参团' });
    }
    console.error('Join error:', err);
    res.status(500).json({ error: '参团失败' });
  }
});

// DELETE /api/sessions/:id/leave
router.delete('/:id/leave', async (req, res) => {
  try {
    const pool = await getPool();
    const sessionId = parseInt(req.params.id);

    const session = await pool.request()
      .input('id', sql.BigInt, sessionId)
      .query("SELECT Session_Status FROM Fact_Session_Schedule WHERE Session_ID = @id");

    if (session.recordset.length === 0) return res.status(404).json({ error: '场次不存在' });
    if (session.recordset[0].Session_Status !== 'Matching') {
      return res.status(400).json({ error: '场次已锁定或已开始，无法退团' });
    }

    await pool.request()
      .input('session', sql.BigInt, sessionId)
      .input('player', sql.Int, req.user.User_ID)
      .query('DELETE FROM Bridge_Player_Registration WHERE Session_ID = @session AND Player_User_ID = @player');

    res.json({ message: '退团成功' });
  } catch (err) {
    console.error('Leave error:', err);
    res.status(500).json({ error: '退团失败' });
  }
});

// PUT /api/registrations/:regId/role
router.put('/registrations/:regId/role', authorize(1, 2, 3), async (req, res) => {
  try {
    const pool = await getPool();
    const { Role_ID } = req.body;
    const regId = parseInt(req.params.regId);

    // 验证角色属于该场次的剧本
    const reg = await pool.request()
      .input('regId', sql.BigInt, regId)
      .query(`SELECT reg.Session_ID, reg.Player_User_ID, sc.Script_ID
              FROM Bridge_Player_Registration reg
              JOIN Fact_Session_Schedule s ON s.Session_ID = reg.Session_ID
              JOIN Asset_Script_Copy_Table sc ON sc.Copy_ID = s.Copy_ID
              WHERE reg.Registration_ID = @regId`);

    if (reg.recordset.length === 0) return res.status(404).json({ error: '参团记录不存在' });

    // 非 Admin/DM 只能改自己的角色
    if (req.user.Role_Type === 1 && req.user.User_ID !== reg.recordset[0].Player_User_ID) {
      return res.status(403).json({ error: '权限不足' });
    }

    if (Role_ID) {
      const roleCheck = await pool.request()
        .input('roleId', sql.Int, Role_ID)
        .query('SELECT Script_ID FROM Script_Role_Definition_Table WHERE Role_ID = @roleId');
      if (roleCheck.recordset.length === 0) return res.status(400).json({ error: '角色不存在' });
      if (roleCheck.recordset[0].Script_ID !== reg.recordset[0].Script_ID) {
        return res.status(400).json({ error: '该角色不属于本次场次的剧本' });
      }
    }

    await pool.request()
      .input('regId', sql.BigInt, regId)
      .input('roleId', sql.Int, Role_ID || null)
      .query('UPDATE Bridge_Player_Registration SET Role_ID = @roleId WHERE Registration_ID = @regId');

    res.json({ message: '角色选定成功' });
  } catch (err) {
    if (err.originalError?.message?.includes('UQ_Session_Role_Filtered')) {
      return res.status(409).json({ error: '该角色已被其他玩家占用' });
    }
    console.error('Pick role error:', err);
    res.status(500).json({ error: '选角失败' });
  }
});

module.exports = router;

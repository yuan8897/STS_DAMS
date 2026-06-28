const { Router } = require('express');
const { getPool, sql } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize, allowAdminOrDmSelf } = require('../middleware/authorize');

const router = Router();
router.use(authenticate);

// GET /api/dms
router.get('/', authorize(3), async (req, res) => {
  try {
    const pool = await getPool();
    const { status } = req.query;
    let query = `SELECT d.*, a.Account_Name
                 FROM DM_Profile_Table d
                 JOIN Account_Base_Table a ON a.User_ID = d.DM_User_ID
                 WHERE a.Is_Deleted = 0`;
    const request = pool.request();
    if (status) {
      query += ` AND d.Employment_Status = @status`;
      request.input('status', sql.NVarChar, status);
    }
    query += ' ORDER BY d.DM_User_ID';

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('List DMs error:', err);
    res.status(500).json({ error: '获取 DM 列表失败' });
  }
});

// GET /api/dms/:id
router.get('/:id', allowAdminOrDmSelf(), async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .query(`SELECT d.*, a.Account_Name, a.Account_Status
              FROM DM_Profile_Table d
              JOIN Account_Base_Table a ON a.User_ID = d.DM_User_ID
              WHERE d.DM_User_ID = @id AND a.Is_Deleted = 0`);

    if (result.recordset.length === 0) return res.status(404).json({ error: 'DM 不存在' });
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Get DM error:', err);
    res.status(500).json({ error: '获取 DM 详情失败' });
  }
});

// PUT /api/dms/:id
router.put('/:id', authorize(3), async (req, res) => {
  try {
    const pool = await getPool();
    const { DM_Stage_Name, Base_Per_Session_Wage, Employment_Status } = req.body;
    await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .input('stage', sql.NVarChar, DM_Stage_Name)
      .input('wage', sql.Decimal(10, 2), Base_Per_Session_Wage)
      .input('status', sql.NVarChar, Employment_Status)
      .query(`UPDATE DM_Profile_Table
              SET DM_Stage_Name = ISNULL(@stage, DM_Stage_Name),
                  Base_Per_Session_Wage = ISNULL(@wage, Base_Per_Session_Wage),
                  Employment_Status = ISNULL(@status, Employment_Status)
              WHERE DM_User_ID = @id`);
    res.json({ message: 'DM 信息更新成功' });
  } catch (err) {
    console.error('Update DM error:', err);
    res.status(500).json({ error: '更新 DM 信息失败' });
  }
});

// GET /api/dms/:id/capabilities
router.get('/:id/capabilities', authorize(2, 3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('dmId', sql.Int, parseInt(req.params.id))
      .query(`SELECT c.*, sd.Script_Title
              FROM DM_Script_Capability_Table c
              JOIN Dim_Script_Dictionary sd ON sd.Script_ID = c.Script_ID
              WHERE c.DM_User_ID = @dmId
              ORDER BY c.Certified_At DESC`);
    res.json(result.recordset);
  } catch (err) {
    console.error('Get capabilities error:', err);
    res.status(500).json({ error: '获取 DM 能力失败' });
  }
});

// POST /api/dms/:id/capabilities
router.post('/:id/capabilities', authorize(2, 3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const { Script_ID, Proficiency_Level } = req.body;
    if (!['Trained', 'Proficient', 'Expert'].includes(Proficiency_Level)) {
      return res.status(400).json({ error: '无效的熟练度等级' });
    }
    await pool.request()
      .input('dmId', sql.Int, parseInt(req.params.id))
      .input('scriptId', sql.Int, Script_ID)
      .input('level', sql.NVarChar, Proficiency_Level)
      .query(`INSERT INTO DM_Script_Capability_Table (DM_User_ID, Script_ID, Proficiency_Level)
              VALUES (@dmId, @scriptId, @level)`);
    res.status(201).json({ message: 'DM 能力添加成功' });
  } catch (err) {
    console.error('Add capability error:', err);
    res.status(500).json({ error: '添加 DM 能力失败' });
  }
});

// DELETE /api/dms/:id/capabilities/:capId
router.delete('/:id/capabilities/:capId', authorize(2, 3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('dmId', sql.Int, parseInt(req.params.id))
      .input('capId', sql.BigInt, parseInt(req.params.capId))
      .query('DELETE FROM DM_Script_Capability_Table WHERE Capability_ID = @capId AND DM_User_ID = @dmId');
    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'DM 能力不存在' });
    res.json({ message: 'DM 能力已移除' });
  } catch (err) {
    console.error('Delete capability error:', err);
    res.status(500).json({ error: '移除 DM 能力失败' });
  }
});

// GET /api/dms/:id/shifts
router.get('/:id/shifts', allowAdminOrDmSelf(), async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('dmId', sql.Int, parseInt(req.params.id))
      .query(`SELECT s.*, sd.Script_Title, sd.Estimated_Duration AS Script_Duration_Minutes
              FROM DM_Shift_Availability_Table s
              LEFT JOIN Dim_Script_Dictionary sd ON sd.Script_ID = s.Script_ID
              WHERE s.DM_User_ID = @dmId
              ORDER BY s.Available_Start DESC`);
    res.json(result.recordset);
  } catch (err) {
    console.error('Get shifts error:', err);
    res.status(500).json({ error: '获取排班失败' });
  }
});

// POST /api/dms/:id/shifts
router.post('/:id/shifts', authorize(2, 3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const { Available_Start, Available_End, Shift_Type, Script_ID } = req.body;
    if (!['Regular', 'Overtime', 'On_Call'].includes(Shift_Type)) {
      return res.status(400).json({ error: '无效的班次类型' });
    }
    const request = pool.request()
      .input('dmId', sql.Int, parseInt(req.params.id))
      .input('start', sql.DateTime2, Available_Start)
      .input('end', sql.DateTime2, Available_End)
      .input('type', sql.NVarChar, Shift_Type);
    if (Script_ID && parseInt(Script_ID) > 0) {
      request.input('scriptId', sql.Int, parseInt(Script_ID));
      await request.query(`INSERT INTO DM_Shift_Availability_Table (DM_User_ID, Available_Start, Available_End, Shift_Type, Script_ID)
              VALUES (@dmId, @start, @end, @type, @scriptId)`);
    } else {
      await request.query(`INSERT INTO DM_Shift_Availability_Table (DM_User_ID, Available_Start, Available_End, Shift_Type)
              VALUES (@dmId, @start, @end, @type)`);
    }
    res.status(201).json({ message: '排班添加成功' });
  } catch (err) {
    console.error('Add shift error:', err);
    res.status(500).json({ error: '添加排班失败' });
  }
});

// PUT /api/dms/shifts/:shiftId
router.put('/shifts/:shiftId', authorize(2, 3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const shiftId = parseInt(req.params.shiftId);

    // Verify shift exists and DM owns it (role 2 can only edit own shifts)
    const shift = await pool.request()
      .input('shiftId', sql.BigInt, shiftId)
      .query('SELECT DM_User_ID FROM DM_Shift_Availability_Table WHERE Shift_ID = @shiftId');
    if (shift.recordset.length === 0) return res.status(404).json({ error: '排班不存在' });
    if (req.user.Role_Type === 2 && shift.recordset[0].DM_User_ID !== req.user.User_ID) {
      return res.status(403).json({ error: '只能编辑自己的排班' });
    }

    const { Available_Start, Available_End, Shift_Type, Script_ID } = req.body;
    const request = pool.request()
      .input('shiftId', sql.BigInt, shiftId)
      .input('start', sql.DateTime2, Available_Start)
      .input('end', sql.DateTime2, Available_End)
      .input('type', sql.NVarChar, Shift_Type);

    let setClauses = [];
    if (Available_Start) setClauses.push('Available_Start = @start');
    if (Available_End) setClauses.push('Available_End = @end');
    if (Shift_Type) setClauses.push('Shift_Type = @type');
    if (Script_ID !== undefined) {
      request.input('scriptId', sql.Int, Script_ID || null);
      setClauses.push('Script_ID = @scriptId');
    }
    if (setClauses.length === 0) return res.status(400).json({ error: '无更新字段' });

    await request.query(`UPDATE DM_Shift_Availability_Table
              SET ${setClauses.join(', ')}
              WHERE Shift_ID = @shiftId`);
    res.json({ message: '排班更新成功' });
  } catch (err) {
    console.error('Update shift error:', err);
    res.status(500).json({ error: '更新排班失败' });
  }
});

// DELETE /api/dms/shifts/:shiftId
router.delete('/shifts/:shiftId', authorize(2, 3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const shiftId = parseInt(req.params.shiftId);

    // Verify shift exists and DM owns it (role 2 can only delete own shifts)
    const shift = await pool.request()
      .input('shiftId', sql.BigInt, shiftId)
      .query('SELECT DM_User_ID FROM DM_Shift_Availability_Table WHERE Shift_ID = @shiftId');
    if (shift.recordset.length === 0) return res.status(404).json({ error: '排班不存在' });
    if (req.user.Role_Type === 2 && shift.recordset[0].DM_User_ID !== req.user.User_ID) {
      return res.status(403).json({ error: '只能删除自己的排班' });
    }

    await pool.request()
      .input('shiftId', sql.BigInt, shiftId)
      .query('DELETE FROM DM_Shift_Availability_Table WHERE Shift_ID = @shiftId');
    res.json({ message: '排班已删除' });
  } catch (err) {
    console.error('Delete shift error:', err);
    res.status(500).json({ error: '删除排班失败' });
  }
});

// GET /api/dms/:id/earnings - DM 收益汇总
router.get('/:id/earnings', authorize(2, 3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const dmId = parseInt(req.params.id);

    // 获取 DM 的所有场次及参团人数
    const sessions = await pool.request()
      .input('dmId', sql.Int, dmId)
      .query(`SELECT s.Session_ID, s.Session_Status, s.Scheduled_Start_Time,
                     s.Frozen_Per_Head_Price, sd.Script_Title, r.Room_Name,
                     sd.Min_Required_Players, sd.Max_Allowed_Players,
                     ISNULL(pcount.Registered_Count, 0) AS Registered_Count
              FROM Fact_Session_Schedule s
              JOIN Asset_Script_Copy_Table sc ON sc.Copy_ID = s.Copy_ID
              JOIN Dim_Script_Dictionary sd ON sd.Script_ID = sc.Script_ID
              JOIN Dim_Store_Room r ON r.Room_ID = s.Room_ID
              LEFT JOIN vw_Session_Player_Count pcount ON pcount.Session_ID = s.Session_ID
              WHERE s.DM_User_ID = @dmId
              ORDER BY s.Scheduled_Start_Time DESC`);

    const allSessions = sessions.recordset;
    const completed = allSessions.filter(s => s.Session_Status === 'Completed');
    const inProgress = allSessions.filter(s => s.Session_Status === 'In_Progress');

    // 计算收入：人头价 × 实际参团人数（Registered_Count=0 时不计收入）
    const calcRevenue = (list) => list.reduce((sum, s) => {
      const count = s.Registered_Count > 0 ? s.Registered_Count : 0;
      return sum + (s.Frozen_Per_Head_Price || 0) * count;
    }, 0);

    const completedRevenue = calcRevenue(completed);
    const estimatedRevenue = calcRevenue([...completed, ...inProgress]);
    const avgRevenue = completed.length > 0 ? Math.round(completedRevenue / completed.length) : 0;

    // 按月分组
    const monthlyMap = {};
    completed.forEach(s => {
      const d = new Date(s.Scheduled_Start_Time);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap[month]) monthlyMap[month] = { count: 0, revenue: 0 };
      monthlyMap[month].count++;
      const count = s.Registered_Count > 0 ? s.Registered_Count : 0;
      monthlyMap[month].revenue += (s.Frozen_Per_Head_Price || 0) * count;
    });

    res.json({
      DM_User_ID: dmId,
      Total_Sessions: allSessions.length,
      Completed_Sessions: completed.length,
      In_Progress_Sessions: inProgress.length,
      Completed_Revenue: completedRevenue,
      Estimated_Revenue: estimatedRevenue,
      Avg_Per_Session_Revenue: avgRevenue,
      Monthly_Data: monthlyMap,
      Sessions: allSessions,
    });
  } catch (err) {
    console.error('DM earnings error:', err);
    res.status(500).json({ error: '获取 DM 收益失败' });
  }
});

module.exports = router;

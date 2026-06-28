const { Router } = require('express');
const { getPool, sql } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const router = Router();
router.use(authenticate);

// GET /api/reviews - 查询评价列表
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const { session_id, dm_id, script_id, rating_min } = req.query;

    let query = `SELECT r.*, a.Account_Name AS Reviewer_Name,
                        sched.DM_User_ID, dm.DM_Stage_Name,
                        sc.Script_ID, sc.Script_Title
                 FROM Fact_Session_Review r
                 JOIN Account_Base_Table a ON a.User_ID = r.Reviewer_User_ID
                 JOIN Fact_Session_Schedule sched ON sched.Session_ID = r.Session_ID
                 JOIN DM_Profile_Table dm ON dm.DM_User_ID = sched.DM_User_ID
                 JOIN Asset_Script_Copy_Table cp ON cp.Copy_ID = sched.Copy_ID
                 JOIN Dim_Script_Dictionary sc ON sc.Script_ID = cp.Script_ID
                 WHERE 1=1`;

    const request = pool.request();
    if (session_id) {
      query += ' AND r.Session_ID = @sessionId';
      request.input('sessionId', sql.BigInt, parseInt(session_id));
    }
    if (dm_id) {
      query += ' AND sched.DM_User_ID = @dmId';
      request.input('dmId', sql.Int, parseInt(dm_id));
    }
    if (script_id) {
      query += ' AND sc.Script_ID = @scriptId';
      request.input('scriptId', sql.Int, parseInt(script_id));
    }
    if (rating_min) {
      query += ' AND r.Overall_Rating >= @ratingMin';
      request.input('ratingMin', sql.TinyInt, parseInt(rating_min));
    }
    query += ' ORDER BY r.Created_At DESC';

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('List reviews error:', err);
    res.status(500).json({ error: '获取评价列表失败' });
  }
});

// GET /api/reviews/:id - 评价详情
router.get('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.BigInt, parseInt(req.params.id))
      .query(`SELECT r.*, a.Account_Name AS Reviewer_Name,
                     sched.DM_User_ID, dm.DM_Stage_Name,
                     sc.Script_Title
              FROM Fact_Session_Review r
              JOIN Account_Base_Table a ON a.User_ID = r.Reviewer_User_ID
              JOIN Fact_Session_Schedule sched ON sched.Session_ID = r.Session_ID
              JOIN DM_Profile_Table dm ON dm.DM_User_ID = sched.DM_User_ID
              JOIN Asset_Script_Copy_Table cp ON cp.Copy_ID = sched.Copy_ID
              JOIN Dim_Script_Dictionary sc ON sc.Script_ID = cp.Script_ID
              WHERE r.Review_ID = @id`);

    if (result.recordset.length === 0) return res.status(404).json({ error: '评价不存在' });
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Get review error:', err);
    res.status(500).json({ error: '获取评价详情失败' });
  }
});

// POST /api/reviews - 提交评价 (Player only)
router.post('/', authorize(1), async (req, res) => {
  try {
    const pool = await getPool();
    const { Session_ID, DM_Rating, Script_Rating, Room_Rating, Overall_Rating, Review_Comment, Tags, Is_Anonymous } = req.body;

    if (!Session_ID || !DM_Rating || !Script_Rating || !Room_Rating || !Overall_Rating) {
      return res.status(400).json({ error: '缺少必填参数' });
    }

    // 验证场次已完成
    const session = await pool.request()
      .input('sessionId', sql.BigInt, Session_ID)
      .query("SELECT Session_ID, Session_Status FROM Fact_Session_Schedule WHERE Session_ID = @sessionId");
    if (session.recordset.length === 0) return res.status(404).json({ error: '场次不存在' });
    if (session.recordset[0].Session_Status !== 'Completed') {
      return res.status(400).json({ error: '仅可对已完成的场次进行评价' });
    }

    // 验证用户参团记录
    const reg = await pool.request()
      .input('sessionId', sql.BigInt, Session_ID)
      .input('userId', sql.Int, req.user.User_ID)
      .query(`SELECT Registration_ID FROM Bridge_Player_Registration
              WHERE Session_ID = @sessionId AND Player_User_ID = @userId`);
    if (reg.recordset.length === 0) {
      return res.status(400).json({ error: '仅参团玩家可评价该场次' });
    }

    const result = await pool.request()
      .input('sessionId', sql.BigInt, Session_ID)
      .input('reviewer', sql.Int, req.user.User_ID)
      .input('regId', sql.BigInt, reg.recordset[0].Registration_ID)
      .input('dmRating', sql.TinyInt, DM_Rating)
      .input('scriptRating', sql.TinyInt, Script_Rating)
      .input('roomRating', sql.TinyInt, Room_Rating)
      .input('overall', sql.TinyInt, Overall_Rating)
      .input('comment', sql.NVarChar, Review_Comment || null)
      .input('tags', sql.NVarChar, Tags || null)
      .input('anonymous', sql.Bit, Is_Anonymous ? 1 : 0)
      .query(`INSERT INTO Fact_Session_Review (Session_ID, Reviewer_User_ID, Registration_ID,
                DM_Rating, Script_Rating, Room_Rating, Overall_Rating, Review_Comment, Tags, Is_Anonymous)
              OUTPUT INSERTED.Review_ID
              VALUES (@sessionId, @reviewer, @regId, @dmRating, @scriptRating, @roomRating,
                      @overall, @comment, @tags, @anonymous)`);

    res.status(201).json({ Review_ID: result.recordset[0].Review_ID, message: '评价提交成功' });
  } catch (err) {
    console.error('Submit review error:', err);
    if (err.originalError) {
      if (err.originalError.message.includes('UNIQUE')) {
        return res.status(409).json({ error: '您已对该场次进行过评价' });
      }
      return res.status(400).json({ error: err.originalError.message });
    }
    res.status(500).json({ error: '提交评价失败' });
  }
});

// GET /api/reviews/dm/:dmId/stats - DM 评价统计
router.get('/dm/:dmId/stats', async (req, res) => {
  try {
    const pool = await getPool();
    const dmId = parseInt(req.params.dmId);

    // 从索引视图获取统计
    const stats = await pool.request()
      .input('dmId', sql.Int, dmId)
      .query(`SELECT v.*, dm.DM_Stage_Name
              FROM vw_DM_Review_Stats v
              JOIN DM_Profile_Table dm ON dm.DM_User_ID = v.DM_User_ID
              WHERE v.DM_User_ID = @dmId`);

    // 获取评分分布
    const distribution = await pool.request()
      .input('dmId', sql.Int, dmId)
      .query(`SELECT r.Overall_Rating, COUNT(*) AS Count
              FROM Fact_Session_Review r
              JOIN Fact_Session_Schedule s ON s.Session_ID = r.Session_ID
              WHERE s.DM_User_ID = @dmId
              GROUP BY r.Overall_Rating
              ORDER BY r.Overall_Rating`);

    res.json({
      Stats: stats.recordset[0] || { DM_User_ID: dmId, Total_Reviews: 0, Avg_Overall_Rating: 0, Avg_DM_Rating: 0 },
      Rating_Distribution: distribution.recordset,
    });
  } catch (err) {
    console.error('DM stats error:', err);
    res.status(500).json({ error: '获取 DM 评价统计失败' });
  }
});

// GET /api/reviews/script/:scriptId/stats - 剧本评价统计
router.get('/script/:scriptId/stats', async (req, res) => {
  try {
    const pool = await getPool();
    const scriptId = parseInt(req.params.scriptId);

    const result = await pool.request()
      .input('scriptId', sql.Int, scriptId)
      .query(`SELECT COUNT_BIG(*) AS Total_Reviews,
                     AVG(CAST(r.Script_Rating AS DECIMAL(3,1))) AS Avg_Script_Rating,
                     AVG(CAST(r.Overall_Rating AS DECIMAL(3,1))) AS Avg_Overall_Rating
              FROM Fact_Session_Review r
              JOIN Fact_Session_Schedule s ON s.Session_ID = r.Session_ID
              JOIN Asset_Script_Copy_Table cp ON cp.Copy_ID = s.Copy_ID
              WHERE cp.Script_ID = @scriptId`);

    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Script stats error:', err);
    res.status(500).json({ error: '获取剧本评价统计失败' });
  }
});

module.exports = router;

const { Router } = require('express');
const { getPool, sql } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { paginate } = require('../utils/pagination');

const router = Router();
router.use(authenticate);

// GET /api/scripts?page=1&size=50&retired=&genre=
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const { retired, genre } = req.query;
    let whereClause = 'WHERE 1=1';
    const reqObj = pool.request();
    if (retired !== undefined) { whereClause += ' AND s.Is_Retired = @retired'; reqObj.input('retired', sql.Bit, parseInt(retired)); }
    if (genre) { whereClause += ' AND s.Primary_Genre = @genre'; reqObj.input('genre', sql.TinyInt, parseInt(genre)); }

    const baseQuery = `SELECT s.*, g.Genre_Name
                       FROM Dim_Script_Dictionary s
                       JOIN Dim_Genre_Lookup g ON g.Genre_ID = s.Primary_Genre
                       ${whereClause}`;
    const countQuery = `SELECT COUNT(*) AS total
                        FROM Dim_Script_Dictionary s
                        JOIN Dim_Genre_Lookup g ON g.Genre_ID = s.Primary_Genre
                        ${whereClause}`;

    const result = await paginate({
      req, baseQuery, countQuery, request: reqObj,
      defaultOrder: ' ORDER BY s.Script_ID',
    });
    res.json(result);
  } catch (err) {
    console.error('List scripts error:', err);
    res.status(500).json({ error: '获取剧本列表失败' });
  }
});

// GET /api/scripts/:id
router.get('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const script = await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .query(`SELECT s.*, g.Genre_Name FROM Dim_Script_Dictionary s
              JOIN Dim_Genre_Lookup g ON g.Genre_ID = s.Primary_Genre
              WHERE s.Script_ID = @id`);
    if (script.recordset.length === 0) return res.status(404).json({ error: '剧本不存在' });

    const roles = await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .query('SELECT * FROM Script_Role_Definition_Table WHERE Script_ID = @id ORDER BY Role_ID');

    res.json({ ...script.recordset[0], Roles: roles.recordset });
  } catch (err) {
    console.error('Get script error:', err);
    res.status(500).json({ error: '获取剧本详情失败' });
  }
});

// POST /api/scripts
router.post('/', authorize(3), async (req, res) => {
  try {
    const pool = await getPool();
    const { Script_Title, Min_Required_Players, Max_Allowed_Players, Estimated_Duration, Base_Price, Primary_Genre } = req.body;
    const result = await pool.request()
      .input('title', sql.NVarChar, Script_Title)
      .input('min', sql.Int, Min_Required_Players)
      .input('max', sql.Int, Max_Allowed_Players)
      .input('duration', sql.Int, Estimated_Duration)
      .input('price', sql.Decimal(10, 2), Base_Price)
      .input('genre', sql.TinyInt, Primary_Genre)
      .query(`INSERT INTO Dim_Script_Dictionary (Script_Title, Min_Required_Players, Max_Allowed_Players, Estimated_Duration, Base_Price, Primary_Genre)
              OUTPUT INSERTED.Script_ID
              VALUES (@title, @min, @max, @duration, @price, @genre)`);
    res.status(201).json({ Script_ID: result.recordset[0].Script_ID });
  } catch (err) {
    console.error('Create script error:', err);
    res.status(500).json({ error: '创建剧本失败' });
  }
});

// PUT /api/scripts/:id
router.put('/:id', authorize(3), async (req, res) => {
  try {
    const pool = await getPool();
    const { Script_Title, Min_Required_Players, Max_Allowed_Players, Estimated_Duration, Base_Price, Primary_Genre } = req.body;
    await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .input('title', sql.NVarChar, Script_Title)
      .input('min', sql.Int, Min_Required_Players)
      .input('max', sql.Int, Max_Allowed_Players)
      .input('duration', sql.Int, Estimated_Duration)
      .input('price', sql.Decimal(10, 2), Base_Price)
      .input('genre', sql.TinyInt, Primary_Genre)
      .query(`UPDATE Dim_Script_Dictionary
              SET Script_Title = ISNULL(@title, Script_Title),
                  Min_Required_Players = ISNULL(@min, Min_Required_Players),
                  Max_Allowed_Players = ISNULL(@max, Max_Allowed_Players),
                  Estimated_Duration = ISNULL(@duration, Estimated_Duration),
                  Base_Price = ISNULL(@price, Base_Price),
                  Primary_Genre = ISNULL(@genre, Primary_Genre)
              WHERE Script_ID = @id`);
    res.json({ message: '剧本更新成功' });
  } catch (err) {
    console.error('Update script error:', err);
    res.status(500).json({ error: '更新剧本失败' });
  }
});

// PUT /api/scripts/:id/retire
router.put('/:id/retire', authorize(3), async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .query('UPDATE Dim_Script_Dictionary SET Is_Retired = 1 WHERE Script_ID = @id');
    res.json({ message: '剧本已下架' });
  } catch (err) {
    console.error('Retire script error:', err);
    res.status(500).json({ error: '下架失败' });
  }
});

// GET /api/scripts/:id/roles
router.get('/:id/roles', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .query('SELECT * FROM Script_Role_Definition_Table WHERE Script_ID = @id ORDER BY Role_ID');
    res.json(result.recordset);
  } catch (err) {
    console.error('Get roles error:', err);
    res.status(500).json({ error: '获取角色列表失败' });
  }
});

// POST /api/scripts/:id/roles
router.post('/:id/roles', authorize(3), async (req, res) => {
  try {
    const pool = await getPool();
    const { Role_Name, Gender_Restriction, Role_Description } = req.body;
    if (!['Male', 'Female', 'Any'].includes(Gender_Restriction)) {
      return res.status(400).json({ error: '无效的性别限制' });
    }
    await pool.request()
      .input('scriptId', sql.Int, parseInt(req.params.id))
      .input('name', sql.NVarChar, Role_Name)
      .input('gender', sql.NVarChar, Gender_Restriction)
      .input('desc', sql.NVarChar, Role_Description || null)
      .query(`INSERT INTO Script_Role_Definition_Table (Script_ID, Role_Name, Gender_Restriction, Role_Description)
              VALUES (@scriptId, @name, @gender, @desc)`);
    res.status(201).json({ message: '角色添加成功' });
  } catch (err) {
    console.error('Add role error:', err);
    res.status(500).json({ error: '添加角色失败' });
  }
});

// PUT /api/scripts/roles/:roleId
router.put('/roles/:roleId', authorize(3), async (req, res) => {
  try {
    const pool = await getPool();
    const { Role_Name, Gender_Restriction, Role_Description } = req.body;
    await pool.request()
      .input('roleId', sql.Int, parseInt(req.params.roleId))
      .input('name', sql.NVarChar, Role_Name)
      .input('gender', sql.NVarChar, Gender_Restriction)
      .input('desc', sql.NVarChar, Role_Description)
      .query(`UPDATE Script_Role_Definition_Table
              SET Role_Name = ISNULL(@name, Role_Name),
                  Gender_Restriction = ISNULL(@gender, Gender_Restriction),
                  Role_Description = ISNULL(@desc, Role_Description)
              WHERE Role_ID = @roleId`);
    res.json({ message: '角色更新成功' });
  } catch (err) {
    console.error('Update role error:', err);
    res.status(500).json({ error: '更新角色失败' });
  }
});

// DELETE /api/scripts/roles/:roleId
router.delete('/roles/:roleId', authorize(3), async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('roleId', sql.Int, parseInt(req.params.roleId))
      .query('DELETE FROM Script_Role_Definition_Table WHERE Role_ID = @roleId');
    res.json({ message: '角色已删除' });
  } catch (err) {
    console.error('Delete role error:', err);
    res.status(500).json({ error: '删除角色失败' });
  }
});

// GET /api/scripts/:id/copies —— DM/Admin/Store_Manager 查看副本列表
router.get('/:id/copies', authorize(2, 3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .query('SELECT * FROM Asset_Script_Copy_Table WHERE Script_ID = @id ORDER BY Copy_ID');
    res.json(result.recordset);
  } catch (err) {
    console.error('Get copies error:', err);
    res.status(500).json({ error: '获取副本列表失败' });
  }
});

// POST /api/scripts/:id/copies —— DM/Admin/Store_Manager 创建剧本副本
router.post('/:id/copies', authorize(2, 3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const { Copy_Asset_Barcode, Authorization_Type, Asset_Condition, Purchase_Date, Current_Storage_Location } = req.body;
    if (!['Boxed', 'Exclusive', 'One_Of_A_Kind'].includes(Authorization_Type)) {
      return res.status(400).json({ error: '无效的授权类型' });
    }
    await pool.request()
      .input('scriptId', sql.Int, parseInt(req.params.id))
      .input('barcode', sql.NVarChar, Copy_Asset_Barcode)
      .input('auth', sql.NVarChar, Authorization_Type)
      .input('condition', sql.NVarChar, Asset_Condition || 'Perfect')
      .input('date', sql.Date, Purchase_Date || new Date())
      .input('location', sql.NVarChar, Current_Storage_Location || null)
      .query(`INSERT INTO Asset_Script_Copy_Table (Copy_Asset_Barcode, Script_ID, Authorization_Type, Asset_Condition, Purchase_Date, Current_Storage_Location)
              VALUES (@barcode, @scriptId, @auth, @condition, @date, @location)`);
    res.status(201).json({ message: '副本添加成功' });
  } catch (err) {
    console.error('Add copy error:', err);
    res.status(500).json({ error: '添加副本失败' });
  }
});

// PUT /api/copies/:copyId —— DM/Admin/Store_Manager 更新副本信息
router.put('/copies/:copyId', authorize(2, 3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const { Copy_Asset_Barcode, Current_Storage_Location } = req.body;
    await pool.request()
      .input('copyId', sql.BigInt, parseInt(req.params.copyId))
      .input('barcode', sql.NVarChar, Copy_Asset_Barcode)
      .input('location', sql.NVarChar, Current_Storage_Location)
      .query(`UPDATE Asset_Script_Copy_Table
              SET Copy_Asset_Barcode = ISNULL(@barcode, Copy_Asset_Barcode),
                  Current_Storage_Location = ISNULL(@location, Current_Storage_Location)
              WHERE Copy_ID = @copyId`);
    res.json({ message: '副本更新成功' });
  } catch (err) {
    console.error('Update copy error:', err);
    res.status(500).json({ error: '更新副本失败' });
  }
});

// PUT /api/copies/:copyId/condition —— DM/Admin/Store_Manager 更新副本状态
router.put('/copies/:copyId/condition', authorize(2, 3, 4), async (req, res) => {
  try {
    const { Asset_Condition } = req.body;
    if (!['Perfect', 'Worn', 'In_Maintenance', 'Scrapped'].includes(Asset_Condition)) {
      return res.status(400).json({ error: '无效的资产状态' });
    }
    const pool = await getPool();
    await pool.request()
      .input('copyId', sql.BigInt, parseInt(req.params.copyId))
      .input('condition', sql.NVarChar, Asset_Condition)
      .query('UPDATE Asset_Script_Copy_Table SET Asset_Condition = @condition WHERE Copy_ID = @copyId');
    res.json({ message: '状态更新成功' });
  } catch (err) {
    console.error('Update condition error:', err);
    res.status(500).json({ error: '更新副本状态失败' });
  }
});

// GET /api/scripts/available-copies —— DM创车时获取可用副本
router.get('/available-copies', authorize(2, 3, 4), async (req, res) => {
  try {
    const { script_id } = req.query;
    if (!script_id) return res.status(400).json({ error: 'script_id 参数必填' });
    const pool = await getPool();
    const result = await pool.request()
      .input('scriptId', sql.Int, parseInt(script_id))
      .query(`SELECT sc.*, s.Script_Title, s.Min_Required_Players, s.Max_Allowed_Players,
                     s.Estimated_Duration, s.Base_Price
              FROM Asset_Script_Copy_Table sc
              JOIN Dim_Script_Dictionary s ON s.Script_ID = sc.Script_ID
              WHERE sc.Script_ID = @scriptId
                AND sc.Asset_Condition <> 'Scrapped'
              ORDER BY sc.Copy_ID`);
    res.json(result.recordset);
  } catch (err) {
    console.error('Get available copies error:', err);
    res.status(500).json({ error: '获取可用副本失败' });
  }
});

module.exports = router;

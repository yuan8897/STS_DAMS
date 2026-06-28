const { Router } = require('express');
const { getPool, sql } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const router = Router();
router.use(authenticate);

// GET /api/rooms
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT * FROM Dim_Store_Room ORDER BY Room_ID');
    res.json(result.recordset);
  } catch (err) {
    console.error('List rooms error:', err);
    res.status(500).json({ error: '获取房间列表失败' });
  }
});

// POST /api/rooms
router.post('/', authorize(3), async (req, res) => {
  try {
    const pool = await getPool();
    const { Room_Name, Room_Max_Capacity, Room_Theme } = req.body;
    if (!Room_Name || !Room_Max_Capacity) {
      return res.status(400).json({ error: '房间名称和最大容量为必填项' });
    }
    const result = await pool.request()
      .input('name', sql.NVarChar, Room_Name)
      .input('capacity', sql.Int, Room_Max_Capacity)
      .input('theme', sql.NVarChar, Room_Theme || null)
      .query(`INSERT INTO Dim_Store_Room (Room_Name, Room_Max_Capacity, Room_Theme, Room_Operating_Status)
              OUTPUT INSERTED.Room_ID
              VALUES (@name, @capacity, @theme, 'Operational')`);
    res.status(201).json({ Room_ID: result.recordset[0].Room_ID });
  } catch (err) {
    console.error('Create room error:', err);
    res.status(500).json({ error: '创建房间失败' });
  }
});

// PUT /api/rooms/:id
router.put('/:id', authorize(3), async (req, res) => {
  try {
    const pool = await getPool();
    const { Room_Name, Room_Max_Capacity, Room_Theme } = req.body;
    await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .input('name', sql.NVarChar, Room_Name)
      .input('capacity', sql.Int, Room_Max_Capacity)
      .input('theme', sql.NVarChar, Room_Theme)
      .query(`UPDATE Dim_Store_Room
              SET Room_Name = ISNULL(@name, Room_Name),
                  Room_Max_Capacity = ISNULL(@capacity, Room_Max_Capacity),
                  Room_Theme = ISNULL(@theme, Room_Theme)
              WHERE Room_ID = @id`);
    res.json({ message: '房间更新成功' });
  } catch (err) {
    console.error('Update room error:', err);
    res.status(500).json({ error: '更新房间失败' });
  }
});

// PUT /api/rooms/:id/status
router.put('/:id/status', authorize(3), async (req, res) => {
  try {
    const { Room_Operating_Status } = req.body;
    if (!['Operational', 'Under_Maintenance'].includes(Room_Operating_Status)) {
      return res.status(400).json({ error: '无效的运营状态' });
    }
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .input('status', sql.NVarChar, Room_Operating_Status)
      .query('UPDATE Dim_Store_Room SET Room_Operating_Status = @status WHERE Room_ID = @id');
    res.json({ message: '房间运营状态更新成功' });
  } catch (err) {
    console.error('Update room status error:', err);
    res.status(500).json({ error: '更新状态失败' });
  }
});

module.exports = router;

const { Router } = require('express');
const { getPool, sql } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const router = Router();
router.use(authenticate);

// GET /api/lookup/genres - 所有登录用户可查看题材列表
router.get('/genres', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT Genre_ID, Genre_Name FROM Dim_Genre_Lookup ORDER BY Genre_ID');
    res.json(result.recordset);
  } catch (err) {
    console.error('List genres error:', err);
    res.status(500).json({ error: '获取题材列表失败' });
  }
});

// POST /api/lookup/genres - Admin 创建题材
router.post('/genres', authorize(3), async (req, res) => {
  try {
    const pool = await getPool();
    const { Genre_Name } = req.body;
    if (!Genre_Name || !Genre_Name.trim()) {
      return res.status(400).json({ error: '题材名称不能为空' });
    }

    const result = await pool.request()
      .input('name', sql.NVarChar, Genre_Name.trim())
      .query(`INSERT INTO Dim_Genre_Lookup (Genre_Name)
              OUTPUT INSERTED.Genre_ID
              VALUES (@name)`);

    res.status(201).json({ Genre_ID: result.recordset[0].Genre_ID, message: '题材添加成功' });
  } catch (err) {
    console.error('Create genre error:', err);
    if (err.originalError?.message?.includes('UNIQUE') || err.originalError?.message?.includes('unique')) {
      return res.status(409).json({ error: '题材名称已存在' });
    }
    res.status(500).json({ error: '创建题材失败' });
  }
});

// PUT /api/lookup/genres/:id - Admin 更新题材
router.put('/genres/:id', authorize(3), async (req, res) => {
  try {
    const pool = await getPool();
    const { Genre_Name } = req.body;
    if (!Genre_Name || !Genre_Name.trim()) {
      return res.status(400).json({ error: '题材名称不能为空' });
    }

    const result = await pool.request()
      .input('id', sql.TinyInt, parseInt(req.params.id))
      .input('name', sql.NVarChar, Genre_Name.trim())
      .query(`UPDATE Dim_Genre_Lookup SET Genre_Name = @name WHERE Genre_ID = @id`);

    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: '题材不存在' });
    res.json({ message: '题材更新成功' });
  } catch (err) {
    console.error('Update genre error:', err);
    if (err.originalError?.message?.includes('UNIQUE') || err.originalError?.message?.includes('unique')) {
      return res.status(409).json({ error: '题材名称已存在' });
    }
    res.status(500).json({ error: '更新题材失败' });
  }
});

// DELETE /api/lookup/genres/:id - Admin 删除题材
router.delete('/genres/:id', authorize(3), async (req, res) => {
  try {
    const pool = await getPool();
    const genreId = parseInt(req.params.id);

    // 检查是否有剧本引用该题材
    const refs = await pool.request()
      .input('id', sql.TinyInt, genreId)
      .query('SELECT COUNT(*) AS cnt FROM Dim_Script_Dictionary WHERE Primary_Genre = @id');
    if (refs.recordset[0].cnt > 0) {
      return res.status(409).json({ error: `该题材被 ${refs.recordset[0].cnt} 个剧本引用，无法删除` });
    }

    const result = await pool.request()
      .input('id', sql.TinyInt, genreId)
      .query('DELETE FROM Dim_Genre_Lookup WHERE Genre_ID = @id');

    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: '题材不存在' });
    res.json({ message: '题材已删除' });
  } catch (err) {
    console.error('Delete genre error:', err);
    res.status(500).json({ error: '删除题材失败' });
  }
});

module.exports = router;

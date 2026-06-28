/**
 * 文件上传路由 — 剧本封面 / DM 头像
 *
 * @swagger
 * /api/upload/script-cover/{scriptId}:
 *   post:
 *     summary: 上传剧本封面
 *     description: 上传剧本封面图片（支持 JPG/PNG/GIF/WebP/BMP，最大 5MB）
 *     tags: [Upload]
 *     parameters:
 *       - in: path
 *         name: scriptId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 剧本 ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [cover]
 *             properties:
 *               cover:
 *                 type: string
 *                 format: binary
 *                 description: 封面图片文件
 *     responses:
 *       200:
 *         description: 上传成功，返回图片 URL
 *
 * /api/upload/dm-avatar/{dmUserId}:
 *   post:
 *     summary: 上传 DM 头像
 *     description: 上传 DM 头像图片（支持 JPG/PNG/GIF/WebP/BMP，最大 5MB）
 *     tags: [Upload]
 *     parameters:
 *       - in: path
 *         name: dmUserId
 *         required: true
 *         schema:
 *           type: integer
 *         description: DM 用户 ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [avatar]
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: 头像图片文件
 *     responses:
 *       200:
 *         description: 上传成功，返回图片 URL
 */
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const express = require('express');
const { getPool, sql } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// 上传目录
const UPLOADS_DIR = path.resolve(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// multer 存储配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件类型: ${ext}，仅支持 ${allowed.join(', ')}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// 静态文件服务 — 通过受控端点代理访问，需认证
// （原 router.use('/file', express.static(UPLOADS_DIR)) 已改为受控端点）
router.get('/file/:filename', authenticate, (req, res) => {
  const filename = path.basename(req.params.filename); // 防止路径穿越
  const filepath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: '文件不存在' });
  }
  res.sendFile(filepath);
});

// POST /api/upload/script-cover/:scriptId — 上传剧本封面
router.post('/script-cover/:scriptId', authenticate, upload.single('cover'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择要上传的图片文件' });
    }

    const scriptId = parseInt(req.params.scriptId, 10);
    if (isNaN(scriptId)) {
      return res.status(400).json({ error: '剧本 ID 无效' });
    }

    const imageUrl = `/api/upload/file/${req.file.filename}`;

    const pool = await getPool();
    await pool.request()
      .input('scriptId', sql.Int, scriptId)
      .input('imageUrl', sql.NVarChar, imageUrl)
      .query(`
        UPDATE Dim_Script_Dictionary
        SET Cover_Image_URL = @imageUrl
        WHERE Script_ID = @scriptId
      `);

    res.json({ success: true, url: imageUrl, filename: req.file.filename });
  } catch (err) {
    console.error('上传剧本封面失败:', err);
    res.status(500).json({ error: '上传失败: ' + err.message });
  }
});

// POST /api/upload/dm-avatar/:dmUserId — 上传 DM 头像
router.post('/dm-avatar/:dmUserId', authenticate, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择要上传的图片文件' });
    }

    const dmUserId = parseInt(req.params.dmUserId, 10);
    if (isNaN(dmUserId)) {
      return res.status(400).json({ error: 'DM 用户 ID 无效' });
    }

    const imageUrl = `/api/upload/file/${req.file.filename}`;

    const pool = await getPool();
    await pool.request()
      .input('dmUserId', sql.Int, dmUserId)
      .input('imageUrl', sql.NVarChar, imageUrl)
      .query(`
        UPDATE DM_Profile_Table
        SET Avatar_Image_URL = @imageUrl
        WHERE DM_User_ID = @dmUserId
      `);

    res.json({ success: true, url: imageUrl, filename: req.file.filename });
  } catch (err) {
    console.error('上传 DM 头像失败:', err);
    res.status(500).json({ error: '上传失败: ' + err.message });
  }
});

// DELETE /api/upload/remove — 删除已上传的图片
router.delete('/remove', authenticate, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: '缺少 url 参数' });
    }

    const filename = url.split('/').pop();
    const filepath = path.join(UPLOADS_DIR, filename);

    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('删除文件失败:', err);
    res.status(500).json({ error: '删除失败: ' + err.message });
  }
});

module.exports = router;

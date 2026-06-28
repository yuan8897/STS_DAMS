const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const http = require('http');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { getPool, closePool } = require('./config/db');
const { startScheduler } = require('./scheduler');
const { attachWebSocket } = require('./wsServer');
const logger = require('./config/logger');

const app = express();
const PORT = process.env.PORT || 8080;

// 中间件
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json({ limit: '1mb' })); // 限制请求体大小，防止 DoS

// 门店上下文中间件（单门店→多门店扩展入口）
const storeContext = require('./middleware/storeContext');
app.use(storeContext);

// 统一响应格式中间件（注入 res.success / res.fail）
const { respond } = require('./utils/response');
app.use(respond);

// 速率限制 — 全局基础限制
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 500,                  // 每 IP 最多 500 次请求
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' },
});
app.use(globalLimiter);

// 速率限制 — 登录/注册端点更严格
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 20,                   // 每 IP 最多 20 次尝试
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '登录尝试过于频繁，请 15 分钟后再试' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// 路由挂载
app.use('/api/auth', require('./routes/auth'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/dms', require('./routes/dms'));
app.use('/api/scripts', require('./routes/scripts'));
app.use('/api/rooms', require('./routes/rooms'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/inventory', require('./routes/inventory'));
// 消费记账挂载在 /api/sessions 下
app.use('/api/sessions', require('./routes/consumptions'));
app.use('/api/audit-logs', require('./routes/audit'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/exports', require('./routes/exports'));
app.use('/api/membership', require('./routes/membership'));
app.use('/api/coupons', require('./routes/coupons'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/store', require('./routes/store'));
app.use('/api/lookup', require('./routes/lookup'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/health', require('./routes/health'));

// Swagger 文档
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'STS-DAMS API 文档',
  customCss: '.swagger-ui .topbar { display: none }',
}));
app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));

// 健康检查
app.get('/api/health', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1');
    const { getStats } = require('./wsServer');
    res.json({ status: 'ok', database: 'connected', websocket: getStats() });
  } catch (err) {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

// 全局错误处理
app.use((err, req, res, _next) => {
  logger.error('未处理的服务器错误', { error: err.message, stack: err.stack, path: req.path });
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON 格式错误' });
  }
  res.status(500).json({ error: '服务器内部错误' });
});

// 启动
async function start() {
  try {
    await getPool();
    const httpServer = http.createServer(app);
    attachWebSocket(httpServer);
    httpServer.listen(PORT, () => {
      logger.info('STS-DAMS API Server 启动成功', {
        port: PORT,
        websocket: `ws://localhost:${PORT}/ws`,
        database: 'STS_DAMS',
      });
      startScheduler();
    });
  } catch (err) {
    logger.error('服务器启动失败', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

// 优雅退出
process.on('SIGINT', async () => {
  logger.info('收到 SIGINT 信号，正在优雅退出...');
  await closePool();
  process.exit(0);
});

start();

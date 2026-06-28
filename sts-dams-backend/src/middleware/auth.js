/**
 * JWT 认证中间件
 *
 * 用法:
 *   const { authenticate } = require('../middleware/auth');
 *   const { authorize } = require('../middleware/authorize');
 *   router.get('/admin-only', authenticate, authorize(3), handler);
 */

const jwt = require('jsonwebtoken');
require('dotenv').config();

// Guard: JWT_SECRET must be set
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Server cannot start.');
  process.exit(1);
}

/**
 * JWT 认证中间件 — 验证 Bearer Token 并注入 req.user
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: '令牌无效或已过期' });
  }
}

module.exports = { authenticate };

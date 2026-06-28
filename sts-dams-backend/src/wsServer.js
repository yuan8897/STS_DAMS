/**
 * STS-DAMS WebSocket 服务器
 * 用途：实时推送通知、场次变更、支付到账、库存预警
 *
 * 启动方式：由 server.js 在 HTTP server 上挂载
 *    const { attachWebSocket } = require('./wsServer');
 *    attachWebSocket(httpServer);
 *
 * 客户端连接：ws://localhost:8080/ws?token=<JWT>
 */
const { parse } = require('url');
const jwt = require('jsonwebtoken');
const logger = require('./config/logger');

if (!process.env.JWT_SECRET) {
  logger.error('JWT_SECRET 环境变量未设置，WebSocket 服务器无法启动');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * @type {Map<number, { sockets: Set<import('ws').WebSocket>, roleType: number }>}
 * User_ID → { 连接集合, 角色类型 }
 * roleType: 1=Player, 2=DM, 3=Admin, 4=Store_Manager
 */
const clients = new Map();

/**
 * 验证 WebSocket 连接的 JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * 挂载 WebSocket 到 HTTP server
 */
function attachWebSocket(httpServer) {
  const { Server } = require('ws');
  const wss = new Server({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const { query } = parse(req.url || '', true);
    const token = query.token;
    if (!token) {
      ws.close(4001, 'Missing JWT token');
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      ws.close(4001, 'Invalid or expired JWT token');
      return;
    }

    const userId = payload.User_ID;
    const roleType = payload.Role_Type || 1; // 从 JWT payload 提取角色类型

    if (!clients.has(userId)) {
      clients.set(userId, { sockets: new Set(), roleType });
    }
    const entry = clients.get(userId);
    entry.sockets.add(ws);
    // 更新角色类型（如果用户角色在会话期间变更）
    entry.roleType = roleType;

    logger.info(`WebSocket 用户 ${userId} 已连接`, { role: roleType, totalUsers: clients.size });

    // 发送连接确认
    ws.send(JSON.stringify({
      type: 'connected',
      payload: { user_id: userId, message: 'WebSocket connected' },
      timestamp: new Date().toISOString(),
    }));

    ws.on('close', () => {
      const entry = clients.get(userId);
      if (entry) {
        entry.sockets.delete(ws);
        if (entry.sockets.size === 0) clients.delete(userId);
      }
      logger.debug(`WebSocket 用户 ${userId} 已断开`);
    });

    ws.on('error', (err) => {
      logger.error(`WebSocket 用户 ${userId} 错误`, { error: err.message });
    });
  });

  logger.info('WebSocket 服务器已挂载到 HTTP server');
  return wss;
}

/**
 * 向指定用户推送消息
 * @param {number} userId
 * @param {string} type - 消息类型
 * @param {object} payload - 消息体
 */
function pushToUser(userId, type, payload) {
  const entry = clients.get(userId);
  if (!entry || entry.sockets.size === 0) return false;

  const message = JSON.stringify({
    type,
    payload,
    timestamp: new Date().toISOString(),
  });

  let delivered = 0;
  for (const ws of entry.sockets) {
    if (ws.readyState === 1) { // OPEN
      ws.send(message);
      delivered++;
    }
  }
  return delivered > 0;
}

/**
 * 向指定角色类型的所有在线用户推送
 * @param {number} roleType - 1=Player, 2=DM, 3=Admin, 4=Store_Manager
 * @param {string} type
 * @param {object} payload
 */
function pushToRole(roleType, type, payload) {
  let delivered = 0;
  const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });

  for (const [userId, entry] of clients) {
    if (entry.roleType !== roleType) continue; // 按角色过滤
    for (const ws of entry.sockets) {
      if (ws.readyState === 1) {
        ws.send(message);
        delivered++;
      }
    }
  }
  return delivered;
}

/**
 * 向所有在线用户广播
 */
function broadcast(type, payload) {
  let delivered = 0;
  const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });

  for (const [, entry] of clients) {
    for (const ws of entry.sockets) {
      if (ws.readyState === 1) {
        ws.send(message);
        delivered++;
      }
    }
  }
  return delivered;
}

/**
 * 获取在线统计
 */
function getStats() {
  let totalConnections = 0;
  for (const [, entry] of clients) {
    totalConnections += entry.sockets.size;
  }
  return {
    total_users: clients.size,
    total_connections: totalConnections,
  };
}

module.exports = { attachWebSocket, pushToUser, pushToRole, broadcast, getStats };

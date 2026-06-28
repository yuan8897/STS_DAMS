/**
 * STS-DAMS 结构化日志模块
 *
 * 替代原始 console.log/error，提供 JSON 格式、日志级别、correlation ID 支持。
 * 后续可替换为 winston / pino 传输层（文件、ELK、CloudWatch）。
 *
 * 用法：
 *   const logger = require('../config/logger');
 *   logger.info('用户登录', { userId: 123, role: 'Admin' });
 *   logger.error('数据库连接失败', { error: err.message, stack: err.stack });
 */

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || 'info'] ?? LOG_LEVELS.info;

function formatLog(level, message, meta = {}) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  });
}

const logger = {
  error(message, meta) {
    if (CURRENT_LEVEL >= LOG_LEVELS.error) {
      console.error(formatLog('error', message, meta));
    }
  },
  warn(message, meta) {
    if (CURRENT_LEVEL >= LOG_LEVELS.warn) {
      console.warn(formatLog('warn', message, meta));
    }
  },
  info(message, meta) {
    if (CURRENT_LEVEL >= LOG_LEVELS.info) {
      console.log(formatLog('info', message, meta));
    }
  },
  debug(message, meta) {
    if (CURRENT_LEVEL >= LOG_LEVELS.debug) {
      console.log(formatLog('debug', message, meta));
    }
  },
};

module.exports = logger;

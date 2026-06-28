const sql = require('mssql');
const path = require('path');
const logger = require('./logger');
const { DB_POOL_MAX } = require('./constants');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

const isTrusted = process.env.DB_TRUSTED === 'true';
const dbConfig = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_NAME || 'STS_DAMS',
  user: isTrusted ? undefined : (process.env.DB_USER || undefined),
  password: isTrusted ? undefined : (process.env.DB_PASSWORD || undefined),
  options: {
    trustedConnection: isTrusted,
    trustServerCertificate: true,
    encrypt: false,
  },
  pool: {
    max: DB_POOL_MAX,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  connectionTimeout: 10000,
  requestTimeout: 15000,
};

let pool;

async function getPool() {
  if (!pool) {
    pool = await sql.connect(dbConfig);
    logger.info('Connected to SQL Server (STS_DAMS)', { poolMax: DB_POOL_MAX });
  }
  return pool;
}

/**
 * 为当前数据库会话设置 CONTEXT_INFO（用于审计触发器 T8 读取操作人信息）
 *
 * CONTEXT_INFO 格式 (VARBINARY 128):
 *   Bytes 0-3:   User_ID (INT, 4 bytes)
 *   Bytes 4-93:  Client_IP (NVARCHAR 45, up to 90 bytes)
 *
 * @param {import('mssql').Request} request - mssql Request 对象
 * @param {number} userId - 操作人 User_ID
 * @param {string} [clientIp] - 客户端 IP 地址
 */
async function setSessionContext(request, userId, clientIp) {
  const buf = Buffer.alloc(128);
  buf.writeInt32BE(userId || 0, 0);  // SQL Server CAST(BINARY(4) AS INT) 使用 Big-Endian
  if (clientIp) {
    const ipStr = String(clientIp).slice(0, 45);
    for (let i = 0; i < ipStr.length; i++) {
      buf.writeUInt16LE(ipStr.charCodeAt(i), 4 + i * 2);
    }
  }
  const hex = '0x' + buf.toString('hex');
  await request.query(`SET CONTEXT_INFO ${hex}`);
}

async function closePool() {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

module.exports = { getPool, closePool, sql, setSessionContext };

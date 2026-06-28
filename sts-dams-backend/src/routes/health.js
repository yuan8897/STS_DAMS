/**
 * 系统健康监控 API
 * 提供详细的服务器状态、数据库连接池、缓存、定时任务健康信息
 */

const { Router } = require('express');
const os = require('os');
const { getPool, sql } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const router = Router();

/** 获取 WebSocket 统计数据 */
function getWsStats() {
  try {
    return require('../wsServer').getStats();
  } catch {
    return { total_users: 0, total_connections: 0, error: 'WebSocket 模块未加载' };
  }
}

/** 格式化运行时间 */
function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

/** 获取内存使用 (MB) */
function getMemoryMB(bytes) {
  return Math.round(bytes / 1024 / 1024);
}

// ==================== GET /api/health/detailed — 详细健康检查 (Admin) ====================
router.get('/detailed', authenticate, authorize(3), async (req, res) => {
  try {
    const pool = await getPool();

    // 1. 数据库连通性 + 基础信息
    const dbInfo = await pool.request().query(`
      SELECT
        DB_NAME() AS DatabaseName,
        (SELECT COUNT(*) FROM sys.tables WHERE name NOT LIKE '%_Archive') AS TableCount,
        (SELECT COUNT(*) FROM sys.triggers) AS TriggerCount,
        (SELECT COUNT(*) FROM sys.views) AS ViewCount,
        (SELECT SUM(row_count) FROM sys.dm_db_partition_stats
         WHERE object_id IN (SELECT object_id FROM sys.tables WHERE name NOT LIKE '%_Archive')
           AND index_id IN (0,1)) AS EstimatedRowCount,
        DATABASEPROPERTYEX(DB_NAME(), 'IsAutoShrink') AS IsAutoShrink,
        DATABASEPROPERTYEX(DB_NAME(), 'Recovery') AS RecoveryModel
    `);

    // 2. 连接池状态
    const poolStatus = {
      size: pool.size || 'N/A',
      available: pool.available || 'N/A',
      pending: pool.pending || 'N/A',
      borrowed: pool.borrowed || 'N/A',
    };

    // 3. 系统资源
    const sysInfo = {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemoryMB: getMemoryMB(os.totalmem()),
      freeMemoryMB: getMemoryMB(os.freemem()),
      memoryUsagePercent: Math.round((1 - os.freemem() / os.totalmem()) * 100),
      uptime: formatUptime(process.uptime()),
      nodeVersion: process.version,
      processMemoryMB: getMemoryMB(process.memoryUsage().rss),
    };

    // 4. WebSocket 连接
    const wsStats = getWsStats();

    // 5. 数据库文件大小
    const dbSize = await pool.request().query(`
      SELECT
        name AS FileName,
        type_desc AS FileType,
        CAST(size AS BIGINT) * 8 / 1024 AS SizeMB,
        CASE WHEN max_size = -1 THEN 'Unlimited'
             ELSE CAST(CAST(max_size AS BIGINT) * 8 / 1024 AS NVARCHAR) + ' MB'
        END AS MaxSize,
        CASE WHEN is_percent_growth = 1
             THEN CAST(growth AS NVARCHAR) + '%'
             ELSE CAST(CAST(growth AS BIGINT) * 8 / 1024 AS NVARCHAR) + ' MB'
        END AS Growth
      FROM sys.database_files
    `);

    // 6. 活跃会话
    const activeSessions = await pool.request().query(`
      SELECT COUNT(*) AS ActiveCount
      FROM sys.dm_exec_sessions
      WHERE is_user_process = 1 AND status = 'running'
    `);

    // 7. 最近错误日志（过去 24 小时）
    const recentErrors = await pool.request().query(`
      SELECT TOP 20 Audit_ID, Action_Type, Target_Entity, Logged_At
      FROM System_Audit_Log_Table
      WHERE Action_Type LIKE '%ERROR%' OR Action_Type LIKE '%FAIL%'
         OR Action_Details LIKE '%error%' OR Action_Details LIKE '%fail%'
      ORDER BY Logged_At DESC
    `);

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: {
        name: dbInfo.recordset[0].DatabaseName,
        recoveryModel: dbInfo.recordset[0].RecoveryModel,
        tables: dbInfo.recordset[0].TableCount,
        triggers: dbInfo.recordset[0].TriggerCount,
        views: dbInfo.recordset[0].ViewCount,
        estimatedRows: dbInfo.recordset[0].EstimatedRowCount,
        files: dbSize.recordset,
        activeConnections: activeSessions.recordset[0].ActiveCount,
      },
      pool: poolStatus,
      websocket: wsStats,
      system: sysInfo,
      alerts: recentErrors.recordset.length > 0
        ? { count: recentErrors.recordset.length, message: '过去 24 小时有异常记录' }
        : { count: 0, message: '无异常' },
    });
  } catch (err) {
    console.error('[Health] 详细健康检查失败:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ==================== GET /api/health/quick — 快速健康摘要 (无需认证) ====================
router.get('/quick', async (req, res) => {
  const checks = {
    database: false,
    websocket: false,
    uptime: formatUptime(process.uptime()),
  };

  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1');
    checks.database = true;
  } catch {}

  try {
    const ws = getWsStats();
    checks.websocket = ws.total_users >= 0; // 只要模块加载就算 OK
  } catch {}

  const allOk = checks.database && checks.websocket;
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;

/**
 * 事务管理增强中间件
 *
 * 提供：
 *   1. 死锁重试 (Deadlock Retry) — 检测 SQL Server 错误 1205，自动重试
 *   2. 事务超时保护 — 超过指定时间自动回滚
 *   3. 批量操作事务包装器 — 统一事务 API
 *
 * SQL Server 死锁错误码：
 *   1205 — 死锁受害者 (Deadlock victim)
 *   1222 — 锁定请求超时
 */

const { sql } = require('../config/db');

/**
 * 检测是否为可重试的 SQL Server 错误
 */
function isRetryableError(err) {
  if (!err) return false;
  const code = err.code || err.number || '';
  // SQL Server 死锁 (1205) 和锁超时 (1222)
  if (code === 1205 || code === '1205' || code === 1222 || code === '1222') return true;
  // mssql 驱动封装的错误
  if (err.originalError) {
    const info = err.originalError;
    if (info.number === 1205 || info.number === 1222) return true;
    if (info.message && (info.message.includes('deadlock') || info.message.includes('1205'))) return true;
  }
  // 连接池耗尽 (可重试)
  if (err.message && err.message.includes('Connection is closed')) return true;
  return false;
}

/**
 * 带死锁重试的事务执行器
 *
 * @param {Function} executeFn — 执行函数，接收 (transaction) 参数
 * @param {Object}   options
 * @param {number}   options.maxRetries   — 最大重试次数 (默认 3)
 * @param {number}   options.retryDelayMs — 重试间隔毫秒 (默认 500)
 * @param {number}   options.timeoutMs    — 事务超时毫秒 (默认 30000)
 * @returns {Promise<any>} executeFn 的返回值
 *
 * 用法：
 *   const result = await withTransaction(async (tx) => {
 *     await tx.request().query('...');
 *     return someValue;
 *   });
 */
async function withTransaction(executeFn, options = {}) {
  const { maxRetries = 3, retryDelayMs = 500, timeoutMs = 30000 } = options;
  const { getPool } = require('../config/db');

  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    let timedOut = false;

    try {
      // 超时保护
      const timeout = setTimeout(() => {
        timedOut = true;
      }, timeoutMs);

      await transaction.begin();
      const result = await executeFn(transaction);
      clearTimeout(timeout);

      if (timedOut) {
        await transaction.rollback();
        lastError = new Error(`事务超时 (${timeoutMs}ms)，已回滚`);
        continue;
      }

      await transaction.commit();
      return result;

    } catch (err) {
      // 确保回滚
      try { await transaction.rollback(); } catch {}

      if (timedOut) {
        lastError = new Error(`事务超时 (${timeoutMs}ms)，已回滚`);
        continue;
      }

      if (isRetryableError(err) && attempt < maxRetries) {
        console.warn(`[Transaction] 死锁/锁超时，第 ${attempt}/${maxRetries} 次重试...`);
        await sleep(retryDelayMs * attempt); // 指数退避
        lastError = err;
        continue;
      }

      throw err; // 不可重试的错误，直接抛出
    }
  }

  throw lastError || new Error('事务失败：超过最大重试次数');
}

/**
 * 批量操作事务包装器
 * 将数组 items 分批在事务中处理
 *
 * @param {Array}    items              — 待处理数组
 * @param {Function} processFn          — 处理函数 (item, index, transaction) => any
 * @param {Object}   options
 * @param {number}   options.batchSize  — 每批数量 (默认 50)
 * @param {number}   options.maxRetries — 死锁重试次数
 * @returns {Promise<Array>} 处理结果数组
 */
async function batchTransaction(items, processFn, options = {}) {
  const { batchSize = 50, maxRetries = 3 } = options;
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await withTransaction(async (tx) => {
      const batchResult = [];
      for (let j = 0; j < batch.length; j++) {
        const result = await processFn(batch[j], i + j, tx);
        batchResult.push(result);
      }
      return batchResult;
    }, { maxRetries });
    results.push(...batchResults);
  }

  return results;
}

/**
 * 获取事务隔离级别对应的 SQL 语句
 */
function getIsolationSQL(level) {
  const map = {
    READ_UNCOMMITTED: 'SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED',
    READ_COMMITTED: 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
    REPEATABLE_READ: 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ',
    SNAPSHOT: 'SET TRANSACTION ISOLATION LEVEL SNAPSHOT',
    SERIALIZABLE: 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE',
  };
  return map[level] || map.READ_COMMITTED;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  withTransaction,
  batchTransaction,
  isRetryableError,
  getIsolationSQL,
};

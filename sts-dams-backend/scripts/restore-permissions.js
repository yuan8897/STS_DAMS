/**
 * 恢复事件溯源四表的 DENY 写保护
 * 用法: node scripts/restore-permissions.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const sql = require('mssql');

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
};

const TABLES = [
  'Payment_Transaction_Table',
  'Inventory_Movement_Ledger',
  'Fact_Session_Consumption',
  'System_Audit_Log_Table',
];

async function main() {
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    console.log('已连接到 SQL Server');

    // 对每张表执行 DENY UPDATE, DELETE
    for (const table of TABLES) {
      await pool.request().query(`DENY UPDATE, DELETE ON ${table} TO PUBLIC`);
      console.log(`  ✓ ${table} — DENY UPDATE, DELETE 已应用`);
    }

    // 验证
    const result = await pool.request().query(`
      SELECT
          OBJECT_NAME(p.major_id) AS TableName,
          p.permission_name,
          p.state_desc
      FROM sys.database_permissions p
      WHERE p.class = 1
        AND p.state_desc = 'DENY'
        AND p.permission_name IN ('UPDATE', 'DELETE')
        AND OBJECT_NAME(p.major_id) IN (
          'Payment_Transaction_Table',
          'Inventory_Movement_Ledger',
          'Fact_Session_Consumption',
          'System_Audit_Log_Table'
        )
      ORDER BY OBJECT_NAME(p.major_id), p.permission_name
    `);

    console.log('\n验证结果:');
    if (result.recordset.length === 0) {
      console.log('  ⚠️ 未找到 DENY 权限记录，请检查表名是否正确');
    } else {
      for (const row of result.recordset) {
        console.log(`  ✓ ${row.TableName} — ${row.permission_name} ${row.state_desc}`);
      }
    }
    console.log(`\n共 ${result.recordset.length} 条 DENY 权限（期望 8 条）`);

  } catch (err) {
    console.error('执行失败:', err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

main();

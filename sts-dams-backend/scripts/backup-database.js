/**
 * STS-DAMS 数据库备份脚本
 *
 * 功能：
 *   1. 完整数据库备份（FULL Backup）→ .bak 文件
 *   2. 仅结构备份（Schema-Only）→ .sql 文件（含 CREATE TABLE + 索引 + 触发器 + 视图）
 *   3. 种子数据备份（Seed Data Export）→ .json 文件
 *
 * 用法：
 *   node scripts/backup-database.js              # 完整备份
 *   node scripts/backup-database.js --schema-only # 仅结构
 *   node scripts/backup-database.js --seed-only   # 仅种子数据
 *   node scripts/backup-database.js --output ../backups/  # 指定输出目录
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { getPool, closePool, sql } = require('../src/config/db');

const BACKUP_DIR = path.resolve(__dirname, '..', 'backups');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

// ==================== 工具函数 ====================

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filepath, content) {
  ensureDir(path.dirname(filepath));
  fs.writeFileSync(filepath, content, 'utf8');
  console.log(`  ✓ 已写入: ${path.relative(process.cwd(), filepath)}`);
}

/** 将 value 转换为安全的 SQL 字面量 */
function sqlLiteral(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'number') return String(val);
  if (val instanceof Date) return `'${val.toISOString().replace('T', ' ').slice(0, 23)}'`;
  // 字符串：转义单引号
  return `N'${String(val).replace(/'/g, "''")}'`;
}

// ==================== 完整备份 (.bak) ====================

async function fullBackup(outputDir) {
  console.log('\n📦 完整数据库备份 (.bak)...');
  try {
    const pool = await getPool();
    const dbName = process.env.DB_NAME || 'STS_DAMS';
    const backupFile = path.join(outputDir, `${dbName}_FULL_${TIMESTAMP}.bak`);

    // 使用 BACKUP DATABASE 命令
    await pool.request().query(`
      BACKUP DATABASE [${dbName}]
      TO DISK = N'${backupFile.replace(/\\/g, '\\\\')}'
      WITH FORMAT, NAME = N'STS_DAMS-Full Database Backup',
      COMPRESSION
    `);

    console.log(`  ✓ 完整备份完成: ${backupFile}`);
    console.log(`    大小: ${(fs.statSync(backupFile).size / 1024 / 1024).toFixed(2)} MB`);
    return backupFile;
  } catch (err) {
    console.error(`  ✗ 完整备份失败: ${err.message}`);
    console.error('    (可能需要 sysadmin 权限或配置备份路径)');
    return null;
  }
}

// ==================== 结构备份 (.sql) ====================

async function schemaBackup(outputDir) {
  console.log('\n📐 数据库结构备份 (.sql)...');

  try {
    const pool = await getPool();
    const dbName = process.env.DB_NAME || 'STS_DAMS';
    let sqlContent = `-- ============================================================\n`;
    sqlContent += `-- STS-DAMS 数据库结构备份\n`;
    sqlContent += `-- 生成时间: ${new Date().toISOString()}\n`;
    sqlContent += `-- 数据库:   ${dbName}\n`;
    sqlContent += `-- ============================================================\n\n`;
    sqlContent += `USE [${dbName}];\nGO\n\n`;

    // 1. 导出所有表结构
    const tables = await pool.request().query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME NOT LIKE '%_Archive'
      ORDER BY TABLE_NAME
    `);

    sqlContent += `-- ============================================================\n`;
    sqlContent += `-- 表结构 (${tables.recordset.length} 张表)\n`;
    sqlContent += `-- ============================================================\n\n`;

    for (const { TABLE_NAME } of tables.recordset) {
      // 获取列定义
      const columns = await pool.request()
        .input('table', sql.NVarChar, TABLE_NAME)
        .query(`
          SELECT COLUMN_NAME, DATA_TYPE,
                 CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE,
                 IS_NULLABLE, COLUMN_DEFAULT
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = @table AND TABLE_SCHEMA = 'dbo'
          ORDER BY ORDINAL_POSITION
        `);

      // 获取主键
      const pk = await pool.request()
        .input('table', sql.NVarChar, TABLE_NAME)
        .query(`
          SELECT c.COLUMN_NAME
          FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE c
            ON c.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
           AND c.TABLE_NAME = tc.TABLE_NAME
          WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
            AND tc.TABLE_NAME = @table
          ORDER BY c.ORDINAL_POSITION
        `);
      const pkCols = pk.recordset.map(r => r.COLUMN_NAME);

      sqlContent += `-- 表: dbo.${TABLE_NAME}\n`;
      sqlContent += `IF OBJECT_ID('dbo.${TABLE_NAME}', 'U') IS NULL\n`;
      sqlContent += `CREATE TABLE dbo.${TABLE_NAME} (\n`;

      const colDefs = columns.recordset.map(col => {
        let def = `  [${col.COLUMN_NAME}] ${col.DATA_TYPE}`;
        if (col.CHARACTER_MAXIMUM_LENGTH) {
          def += col.CHARACTER_MAXIMUM_LENGTH === -1
            ? '(MAX)' : `(${col.CHARACTER_MAXIMUM_LENGTH})`;
        } else if (col.DATA_TYPE === 'decimal' || col.DATA_TYPE === 'numeric') {
          def += `(${col.NUMERIC_PRECISION},${col.NUMERIC_SCALE})`;
        }
        def += col.IS_NULLABLE === 'NO' ? ' NOT NULL' : ' NULL';
        if (col.COLUMN_DEFAULT) def += ` DEFAULT ${col.COLUMN_DEFAULT}`;
        return def;
      });

      if (pkCols.length > 0) {
        colDefs.push(`  CONSTRAINT PK_${TABLE_NAME} PRIMARY KEY (${pkCols.map(c => `[${c}]`).join(', ')})`);
      }

      sqlContent += colDefs.join(',\n') + '\n);\nGO\n\n';
    }

    // 2. 导出索引（非 PK 自动索引）
    sqlContent += `-- ============================================================\n`;
    sqlContent += `-- 索引\n`;
    sqlContent += `-- ============================================================\n\n`;

    const indexes = await pool.request().query(`
      SELECT t.name AS TableName, i.name AS IndexName,
             i.type_desc, i.is_unique, i.has_filter, i.filter_definition
      FROM sys.indexes i
      JOIN sys.tables t ON i.object_id = t.object_id
      WHERE i.is_primary_key = 0 AND i.name IS NOT NULL
        AND t.name NOT LIKE '%_Archive'
      ORDER BY t.name, i.name
    `);

    for (const idx of indexes.recordset) {
      // 获取索引列
      const idxCols = await pool.request()
        .input('table', sql.NVarChar, idx.TableName)
        .input('index', sql.NVarChar, idx.IndexName)
        .query(`
          SELECT c.name AS ColumnName, ic.is_included_column
          FROM sys.index_columns ic
          JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
          WHERE ic.object_id = OBJECT_ID(@table)
            AND ic.index_id = (SELECT index_id FROM sys.indexes WHERE name = @index AND object_id = OBJECT_ID(@table))
          ORDER BY ic.key_ordinal, ic.index_column_id
        `);

      const keyCols = idxCols.recordset.filter(c => !c.is_included_column).map(c => `[${c.ColumnName}]`);
      const incCols = idxCols.recordset.filter(c => c.is_included_column).map(c => `[${c.ColumnName}]`);

      sqlContent += `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = '${idx.IndexName}' AND object_id = OBJECT_ID('dbo.${idx.TableName}'))\n`;
      sqlContent += `CREATE${idx.is_unique ? ' UNIQUE' : ''} NONCLUSTERED INDEX [${idx.IndexName}]\n`;
      sqlContent += `ON dbo.${idx.TableName} (${keyCols.join(', ')})\n`;
      if (incCols.length > 0) sqlContent += `INCLUDE (${incCols.join(', ')})\n`;
      if (idx.has_filter && idx.filter_definition) {
        sqlContent += `WHERE ${idx.filter_definition}\n`;
      }
      sqlContent += `;\nGO\n\n`;
    }

    // 3. 导出触发器
    sqlContent += `-- ============================================================\n`;
    sqlContent += `-- 触发器\n`;
    sqlContent += `-- ============================================================\n\n`;

    const triggers = await pool.request().query(`
      SELECT t.name AS TriggerName, OBJECT_NAME(t.parent_id) AS TableName,
             m.definition AS TriggerBody
      FROM sys.triggers t
      JOIN sys.sql_modules m ON t.object_id = m.object_id
      WHERE t.parent_class = 1
      ORDER BY t.name
    `);

    for (const trg of triggers.recordset) {
      sqlContent += `-- 触发器: ${trg.TriggerName} (表: ${trg.TableName})\n`;
      sqlContent += `IF OBJECT_ID('dbo.${trg.TriggerName}', 'TR') IS NOT NULL\n`;
      sqlContent += `  DROP TRIGGER dbo.${trg.TriggerName};\nGO\n\n`;
      sqlContent += trg.TriggerBody + '\nGO\n\n';
    }

    // 4. 导出视图
    sqlContent += `-- ============================================================\n`;
    sqlContent += `-- 视图\n`;
    sqlContent += `-- ============================================================\n\n`;

    const views = await pool.request().query(`
      SELECT v.name AS ViewName, m.definition AS ViewBody
      FROM sys.views v
      JOIN sys.sql_modules m ON v.object_id = m.object_id
      ORDER BY v.name
    `);

    for (const vw of views.recordset) {
      sqlContent += `-- 视图: ${vw.ViewName}\n`;
      sqlContent += `IF OBJECT_ID('dbo.${vw.ViewName}', 'V') IS NOT NULL\n`;
      sqlContent += `  DROP VIEW dbo.${vw.ViewName};\nGO\n\n`;
      sqlContent += vw.ViewBody + '\nGO\n\n';
    }

    const filename = `${dbName}_SCHEMA_${TIMESTAMP}.sql`;
    writeFile(path.join(outputDir, filename), sqlContent);
    return path.join(outputDir, filename);
  } catch (err) {
    console.error(`  ✗ 结构备份失败: ${err.message}`);
    return null;
  }
}

// ==================== 种子数据备份 (.json) ====================

/** 需要导出数据的表（按依赖顺序） */
const SEED_TABLES = [
  'Dim_Role_Lookup',
  'Dim_Genre_Lookup',
  'Dim_Member_Level',
  'Dim_Script_Dictionary',
  'Script_Role_Definition_Table',
  'Dim_Store_Room',
  'Dim_Inventory_Item',
  'Account_Base_Table',
  'DM_Profile_Table',
  'DM_Script_Capability_Table',
  'DM_Shift_Availability_Table',
  'Asset_Script_Copy_Table',
  'Dim_Store_Info',
  'Coupon_Template',
  'Fact_Session_Schedule',
  'Bridge_Player_Registration',
  'Payment_Transaction_Table',
  'User_Member_Profile',
  'Member_Points_Ledger',
  'User_Coupon_Instance',
  'Fact_Session_Review',
  'Inventory_Movement_Ledger',
  'Fact_Session_Consumption',
  'System_Audit_Log_Table',
  'User_Notification',
];

async function seedDataBackup(outputDir) {
  console.log('\n🌱 种子数据备份 (.json)...');

  try {
    const pool = await getPool();
    const exportData = {
      exported_at: new Date().toISOString(),
      database: process.env.DB_NAME || 'STS_DAMS',
      tables: {},
    };

    for (const table of SEED_TABLES) {
      try {
        const result = await pool.request().query(`SELECT * FROM dbo.${table}`);
        exportData.tables[table] = {
          rowCount: result.recordset.length,
          rows: result.recordset,
        };
        console.log(`  ${table}: ${result.recordset.length} 行`);
      } catch (err) {
        console.log(`  ${table}: 跳过 (${err.message})`);
      }
    }

    // 生成 INSERT 语句文件
    let sqlContent = `-- STS-DAMS 种子数据导出\n`;
    sqlContent += `-- 导出时间: ${new Date().toISOString()}\n`;
    sqlContent += `-- 共 ${Object.keys(exportData.tables).length} 张表\n\n`;

    for (const [table, data] of Object.entries(exportData.tables)) {
      if (data.rowCount === 0) continue;

      // 获取列名
      const columns = Object.keys(data.rows[0]);
      const colList = columns.map(c => `[${c}]`).join(', ');

      sqlContent += `-- ====== ${table} (${data.rowCount} 行) ======\n\n`;

      for (const row of data.rows) {
        const values = columns.map(col => sqlLiteral(row[col])).join(', ');
        sqlContent += `IF NOT EXISTS (SELECT 1 FROM dbo.${table} WHERE ${columns[0]} = ${sqlLiteral(row[columns[0]])})\n`;
        sqlContent += `  INSERT INTO dbo.${table} (${colList}) VALUES (${values});\n`;
      }
      sqlContent += `\n`;
    }

    const jsonFile = path.join(outputDir, `${process.env.DB_NAME || 'STS_DAMS'}_SEED_${TIMESTAMP}.json`);
    writeFile(jsonFile, JSON.stringify(exportData, null, 2));

    const sqlFile = path.join(outputDir, `${process.env.DB_NAME || 'STS_DAMS'}_SEED_${TIMESTAMP}.sql`);
    writeFile(sqlFile, sqlContent);

    return { jsonFile, sqlFile };
  } catch (err) {
    console.error(`  ✗ 种子数据备份失败: ${err.message}`);
    return null;
  }
}

// ==================== 恢复功能 ====================

async function restoreFromBackup(backupFile) {
  console.log(`\n🔄 从备份恢复: ${backupFile}`);

  if (!fs.existsSync(backupFile)) {
    console.error(`  ✗ 备份文件不存在: ${backupFile}`);
    return false;
  }

  try {
    const pool = await getPool();
    const dbName = process.env.DB_NAME || 'STS_DAMS';

    // 切换到单用户模式，关闭现有连接，然后恢复
    await pool.request().query(`
      ALTER DATABASE [${dbName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      RESTORE DATABASE [${dbName}]
      FROM DISK = N'${backupFile.replace(/\\/g, '\\\\')}'
      WITH REPLACE, RECOVERY;
      ALTER DATABASE [${dbName}] SET MULTI_USER;
    `);

    console.log(`  ✓ 数据库已从备份恢复`);
    return true;
  } catch (err) {
    console.error(`  ✗ 恢复失败: ${err.message}`);
    return false;
  }
}

// ==================== 主入口 ====================

async function main() {
  const args = process.argv.slice(2);
  const modeSchemaOnly = args.includes('--schema-only');
  const modeSeedOnly = args.includes('--seed-only');
  const modeFull = !modeSchemaOnly && !modeSeedOnly;

  let outputDir = BACKUP_DIR;
  const outputIdx = args.indexOf('--output');
  if (outputIdx >= 0 && args[outputIdx + 1]) {
    outputDir = path.resolve(args[outputIdx + 1]);
  }

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   STS-DAMS 数据库备份工具                    ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  输出目录: ${outputDir}`);
  console.log(`  时间戳:   ${TIMESTAMP}`);

  ensureDir(outputDir);

  try {
    if (modeFull || modeSchemaOnly) {
      await schemaBackup(outputDir);
    }
    if (modeFull || modeSeedOnly) {
      await seedDataBackup(outputDir);
    }
    if (modeFull) {
      await fullBackup(outputDir);
    }

    console.log('\n✅ 备份完成！');
  } finally {
    await closePool();
  }
}

// 直接运行
if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { fullBackup, schemaBackup, seedDataBackup, restoreFromBackup };

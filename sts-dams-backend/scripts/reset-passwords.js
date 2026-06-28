/**
 * 密码重置部署脚本 — N-DB-2
 *
 * 用途: 在部署后将种子密码 '123456' 替换为安全密码。
 *       解决种子 SQL 文件中明文密码可见的安全问题。
 *
 * 用法:
 *   node scripts/reset-passwords.js --random          # 为所有用户生成随机密码
 *   node scripts/reset-passwords.js --file cred.csv   # 从 CSV 文件读取密码
 *   node scripts/reset-passwords.js                   # 交互式逐个输入密码
 *
 * CSV 格式: User_ID,Password
 *   1,NewP@ss1
 *   2,AnotherP@ss2
 *
 * 输出: .deployment-credentials.txt（已 gitignore，由部署者安全分发）
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const sql = require('mssql');
const fs = require('fs');
const readline = require('readline');

const BCRYPT_ROUNDS = 10;
const RANDOM_PASSWORD_LENGTH = 12;
const OUTPUT_FILE = path.resolve(__dirname, '..', '.deployment-credentials.txt');

// ─── helpers ─────────────────────────────────────────────

function generateRandomPassword(len = RANDOM_PASSWORD_LENGTH) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*';
  const all = upper + lower + digits + symbols;

  // 确保至少包含一个字符从每个类别
  let pwd = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];

  for (let i = pwd.length; i < len; i++) {
    pwd.push(all[Math.floor(Math.random() * all.length)]);
  }

  // Fisher-Yates shuffle
  for (let i = pwd.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
  }

  return pwd.join('');
}

async function getConfig() {
  return {
    server: process.env.DB_SERVER || 'localhost',
    port: parseInt(process.env.DB_PORT || '1433'),
    database: process.env.DB_NAME || 'STS_DAMS',
    user: process.env.DB_USER || 'dams_user',
    password: process.env.DB_PASSWORD || 'StsDams2026!',
    options: {
      trustServerCertificate: true,
      encrypt: false,
    },
  };
}

async function getUsers(pool) {
  const result = await pool.request()
    .query(`SELECT User_ID, Account_Name, Role_Type
            FROM Account_Base_Table
            WHERE Is_Deleted = 0
            ORDER BY User_ID`);
  return result.recordset;
}

async function readCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const map = new Map();
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [id, pwd] = trimmed.split(',');
    if (id && pwd) map.set(parseInt(id.trim()), pwd.trim());
  }
  return map;
}

async function promptPassword(userName) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => {
    rl.question(`  ${userName} 的新密码: `, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ─── main ─────────────────────────────────────────────────

async function main() {
  const mode = process.argv.includes('--random') ? 'random'
    : process.argv.includes('--file') ? 'file' : 'interactive';
  const csvPath = mode === 'file'
    ? process.argv[process.argv.indexOf('--file') + 1] : null;

  console.log('=== STS-DAMS 密码重置工具 ===\n');
  console.log(`模式: ${mode === 'random' ? '随机生成' : mode === 'file' ? `CSV 导入 (${csvPath})` : '交互式输入'}`);
  console.log(`bcrypt 轮数: ${BCRYPT_ROUNDS}\n`);

  // 连接数据库
  const config = await getConfig();
  console.log(`连接数据库: ${config.server}:${config.port}/${config.database} ...`);
  const pool = await sql.connect(config);
  console.log('已连接。\n');

  // 获取用户列表
  const users = await getUsers(pool);
  console.log(`找到 ${users.length} 个活跃用户:\n`);
  for (const u of users) {
    const roleMap = { 1: 'Player', 2: 'DM', 3: 'Admin', 4: 'Store_Manager' };
    console.log(`  [${u.User_ID}] ${u.Account_Name} (${roleMap[u.Role_Type] || u.Role_Type})`);
  }
  console.log();

  // 获取新密码
  /** @type {Map<number, string>} */
  let passwordMap;
  if (mode === 'file') {
    passwordMap = await readCSV(csvPath);
    console.log(`从 CSV 读取了 ${passwordMap.size} 个密码。\n`);
  } else if (mode === 'random') {
    passwordMap = new Map();
    for (const u of users) {
      passwordMap.set(u.User_ID, generateRandomPassword());
    }
    console.log(`生成了 ${passwordMap.size} 个随机密码。\n`);
  } else {
    passwordMap = new Map();
    for (const u of users) {
      const pwd = await promptPassword(u.Account_Name);
      if (!pwd) {
        console.error('错误: 密码不能为空。已取消。');
        await pool.close();
        process.exit(1);
      }
      passwordMap.set(u.User_ID, pwd);
    }
    console.log();
  }

  // 确认
  if (mode !== 'random') {
    console.log('即将更新以下用户的密码:');
    for (const u of users) {
      if (passwordMap.has(u.User_ID)) {
        console.log(`  [${u.User_ID}] ${u.Account_Name}`);
      }
    }
    console.log();
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const confirm = await new Promise(resolve => rl.question('确认执行? (yes/no): ', answer => { rl.close(); resolve(answer.trim().toLowerCase()); }));
    if (confirm !== 'yes') {
      console.log('已取消。');
      await pool.close();
      process.exit(0);
    }
    console.log();
  }

  // 事务内批量更新
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  const credentials = [];

  try {
    for (const u of users) {
      const plainPwd = passwordMap.get(u.User_ID);
      if (!plainPwd) {
        console.log(`  [${u.User_ID}] ${u.Account_Name} — 跳过 (无密码)`);
        continue;
      }

      const hash = bcrypt.hashSync(plainPwd, BCRYPT_ROUNDS);
      await transaction.request()
        .input('id', sql.Int, u.User_ID)
        .input('hash', sql.VarBinary, Buffer.from(hash))
        .query('UPDATE Account_Base_Table SET Password_Hash = @hash WHERE User_ID = @id');

      credentials.push({ id: u.User_ID, name: u.Account_Name, password: plainPwd });
      console.log(`  [${u.User_ID}] ${u.Account_Name} — ✅ 已更新`);
    }

    await transaction.commit();
    console.log(`\n事务已提交。${credentials.length} 个密码已更新。`);
  } catch (err) {
    console.error('\n错误:', err.message);
    try { await transaction.rollback(); } catch (_) {}
    console.log('事务已回滚，数据库未变更。');
    await pool.close();
    process.exit(1);
  }

  // 写入凭证文件
  const header = `# STS-DAMS 部署凭证 — ${new Date().toISOString().split('T')[0]}
# ⚠️  此文件包含明文密码，请安全保存并在分发后删除！
# 格式: User_ID,Account_Name,Password
`;
  const csv = credentials.map(c => `${c.id},${c.name},${c.password}`).join('\n');
  fs.writeFileSync(OUTPUT_FILE, header + csv, 'utf8');
  console.log(`\n凭证已保存到: ${OUTPUT_FILE}`);
  console.log('⚠️  请安全分发密码后删除此文件。');

  await pool.close();
}

main().catch(err => {
  console.error('未处理的错误:', err);
  process.exit(1);
});

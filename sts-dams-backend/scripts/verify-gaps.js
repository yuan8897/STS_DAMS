/**
 * STS-DAMS 最终数据完整性验证
 * 2026-06-04 — 验证补齐后数据：表行数、外键完整性、业务一致性
 */
const { getPool, sql } = require('../src/config/db');

async function main() {
  const pool = await getPool();
  const ok = '✓', warn = '△', err_sym = '✗';
  const issues = [];

  console.log('========================================');
  console.log('  STS-DAMS 最终数据完整性验证');
  console.log('========================================\n');

  // 1. Core table counts vs report targets
  console.log('--- 1. 表行数对比报告目标 ---');
  const expected = {
    'Account_Base_Table': 9, 'DM_Profile_Table': 3, 'DM_Shift_Availability_Table': 12,
    'Fact_Session_Schedule': 12, 'Bridge_Player_Registration': 31,
    'Payment_Transaction_Table': 12, 'Fact_Session_Consumption': 9,
    'Inventory_Movement_Ledger': 25, 'Discount_Usage_Log': 1,
    'System_Audit_Log_Table': 21, 'Daily_KPI_Snapshot': 3, 'Daily_User_LTV_Snapshot': 4,
    'Member_Points_Ledger': 13, 'User_Coupon_Instance': 8,
    'Fact_Session_Review': 10, 'User_Notification': 35,
    'Dim_Script_Dictionary': 6, 'Dim_Inventory_Item': 7
  };
  for (const [tbl, target] of Object.entries(expected)) {
    const r = await pool.request().query('SELECT COUNT(*) cnt FROM ' + tbl);
    const actual = r.recordset[0].cnt;
    const mark = actual === target ? ok : (actual >= target ? warn : err_sym);
    if (mark !== ok) issues.push(tbl + ': expected ' + target + ' got ' + actual);
    console.log('  ' + mark + ' ' + tbl + ': ' + actual + ' (target ' + target + ')');
  }

  // 2. Foreign key integrity
  console.log('\n--- 2. 外键完整性检查 ---');
  const fkChecks = [
    { name: 'Registration->Session', sql: "SELECT COUNT(*) cnt FROM Bridge_Player_Registration r LEFT JOIN Fact_Session_Schedule s ON r.Session_ID = s.Session_ID WHERE s.Session_ID IS NULL" },
    { name: 'Registration->Account', sql: "SELECT COUNT(*) cnt FROM Bridge_Player_Registration r LEFT JOIN Account_Base_Table a ON r.Player_User_ID = a.User_ID WHERE a.User_ID IS NULL" },
    { name: 'Payment->Registration', sql: "SELECT COUNT(*) cnt FROM Payment_Transaction_Table p LEFT JOIN Bridge_Player_Registration r ON p.Registration_ID = r.Registration_ID WHERE r.Registration_ID IS NULL" },
    { name: 'Consumption->Session', sql: "SELECT COUNT(*) cnt FROM Fact_Session_Consumption c LEFT JOIN Fact_Session_Schedule s ON c.Session_ID = s.Session_ID WHERE s.Session_ID IS NULL" },
    { name: 'Consumption->Item', sql: "SELECT COUNT(*) cnt FROM Fact_Session_Consumption c LEFT JOIN Dim_Inventory_Item i ON c.Item_ID = i.Item_ID WHERE i.Item_ID IS NULL" },
    { name: 'InvMovement->Item', sql: "SELECT COUNT(*) cnt FROM Inventory_Movement_Ledger m LEFT JOIN Dim_Inventory_Item i ON m.Item_ID = i.Item_ID WHERE i.Item_ID IS NULL" },
    { name: 'Notification->User', sql: "SELECT COUNT(*) cnt FROM User_Notification n LEFT JOIN Account_Base_Table a ON n.Recipient_User_ID = a.User_ID WHERE a.User_ID IS NULL" },
    { name: 'Review->Session', sql: "SELECT COUNT(*) cnt FROM Fact_Session_Review r LEFT JOIN Fact_Session_Schedule s ON r.Session_ID = s.Session_ID WHERE s.Session_ID IS NULL" },
    { name: 'Review->User', sql: "SELECT COUNT(*) cnt FROM Fact_Session_Review r LEFT JOIN Account_Base_Table a ON r.Reviewer_User_ID = a.User_ID WHERE a.User_ID IS NULL" },
    { name: 'Coupon->User', sql: "SELECT COUNT(*) cnt FROM User_Coupon_Instance c LEFT JOIN Account_Base_Table a ON c.User_ID = a.User_ID WHERE a.User_ID IS NULL" },
    { name: 'Coupon->Template', sql: "SELECT COUNT(*) cnt FROM User_Coupon_Instance c LEFT JOIN Coupon_Template t ON c.Template_ID = t.Template_ID WHERE t.Template_ID IS NULL" },
    { name: 'PointsLedger->User', sql: "SELECT COUNT(*) cnt FROM Member_Points_Ledger p LEFT JOIN Account_Base_Table a ON p.User_ID = a.User_ID WHERE a.User_ID IS NULL" },
    { name: 'DiscountUsage->Coupon', sql: "SELECT COUNT(*) cnt FROM Discount_Usage_Log d LEFT JOIN User_Coupon_Instance c ON d.Coupon_ID = c.Coupon_ID WHERE c.Coupon_ID IS NULL" },
    { name: 'AuditLog->Account', sql: "SELECT COUNT(*) cnt FROM System_Audit_Log_Table l LEFT JOIN Account_Base_Table a ON l.Operator_User_ID = a.User_ID WHERE a.User_ID IS NULL" },
    { name: 'DM_Profile->Account', sql: "SELECT COUNT(*) cnt FROM DM_Profile_Table d LEFT JOIN Account_Base_Table a ON d.DM_User_ID = a.User_ID WHERE a.User_ID IS NULL" },
    { name: 'Session->Copy', sql: "SELECT COUNT(*) cnt FROM Fact_Session_Schedule s LEFT JOIN Asset_Script_Copy_Table c ON s.Copy_ID = c.Copy_ID WHERE c.Copy_ID IS NULL" },
    { name: 'Session->Room', sql: "SELECT COUNT(*) cnt FROM Fact_Session_Schedule s LEFT JOIN Dim_Store_Room r ON s.Room_ID = r.Room_ID WHERE r.Room_ID IS NULL" },
    { name: 'Session->DM', sql: "SELECT COUNT(*) cnt FROM Fact_Session_Schedule s LEFT JOIN DM_Profile_Table d ON s.DM_User_ID = d.DM_User_ID WHERE d.DM_User_ID IS NULL" },
    { name: 'KPI->Store', sql: "SELECT COUNT(*) cnt FROM Daily_KPI_Snapshot k LEFT JOIN Dim_Store_Info s ON k.Store_ID = s.Store_ID WHERE s.Store_ID IS NULL" },
  ];
  for (const check of fkChecks) {
    const r = await pool.request().query(check.sql);
    const orphans = r.recordset[0].cnt;
    const mark = orphans === 0 ? ok : err_sym;
    if (mark !== ok) issues.push('Orphaned FK: ' + check.name + ' (' + orphans + ' rows)');
    console.log('  ' + mark + ' ' + check.name + ': ' + orphans + ' orphans');
  }

  // 3. Business logic consistency
  console.log('\n--- 3. 业务逻辑一致性 ---');

  // Point balance consistency (compare stored vs latest Points_Balance_After)
  const ptBal = await pool.request().query(`
    SELECT mp.User_ID, ab.Account_Name, mp.Accumulated_Points stored_balance,
      ISNULL((SELECT TOP 1 Points_Balance_After FROM Member_Points_Ledger WHERE User_ID = mp.User_ID ORDER BY Created_At DESC, Ledger_ID DESC), 0) calc_balance
    FROM User_Member_Profile mp JOIN Account_Base_Table ab ON mp.User_ID = ab.User_ID
    ORDER BY mp.User_ID
  `);
  ptBal.recordset.forEach(r => {
    const match = r.stored_balance === r.calc_balance;
    if (!match) issues.push(r.Account_Name + ' points mismatch: stored=' + r.stored_balance + ' last_balance=' + r.calc_balance);
    console.log('  ' + (match ? ok : err_sym) + ' ' + r.Account_Name + ': stored=' + r.stored_balance + ' last_balance=' + r.calc_balance);
  });

  // Inventory consistency
  const invBal = await pool.request().query(`
    SELECT i.Item_ID, i.Item_Name, i.Current_Stock_Cache stored_stock,
      ISNULL((SELECT SUM(Quantity_Delta) FROM Inventory_Movement_Ledger WHERE Item_ID = i.Item_ID), 0) calc_stock
    FROM Dim_Inventory_Item i ORDER BY i.Item_ID
  `);
  invBal.recordset.forEach(r => {
    const match = r.stored_stock === r.calc_stock;
    if (!match) issues.push(r.Item_Name + ' stock mismatch: stored=' + r.stored_stock + ' calc=' + r.calc_stock);
    console.log('  ' + (match ? ok : err_sym) + ' ' + r.Item_Name + ': stored=' + r.stored_stock + ' calc=' + r.calc_stock);
  });

  // 4. Image URL coverage
  console.log('\n--- 4. 图片URL覆盖 ---');
  const nullCovers = await pool.request().query("SELECT COUNT(*) cnt FROM Dim_Script_Dictionary WHERE Cover_Image_URL IS NULL");
  console.log('  ' + (nullCovers.recordset[0].cnt === 0 ? ok : err_sym) + ' Script covers: ' + (6 - nullCovers.recordset[0].cnt) + '/6 filled');
  const nullAvatars = await pool.request().query("SELECT COUNT(*) cnt FROM DM_Profile_Table WHERE Avatar_Image_URL IS NULL");
  console.log('  ' + (nullAvatars.recordset[0].cnt === 0 ? ok : err_sym) + ' DM avatars: ' + (3 - nullAvatars.recordset[0].cnt) + '/3 filled');

  // 5. Session status distribution
  console.log('\n--- 5. 场次状态分布 ---');
  const sess = await pool.request().query("SELECT Session_Status, COUNT(*) cnt FROM Fact_Session_Schedule GROUP BY Session_Status ORDER BY Session_Status");
  sess.recordset.forEach(r => console.log('  ' + r.Session_Status + ': ' + r.cnt));

  // 6. Payment type x method matrix
  console.log('\n--- 6. 支付类型 x 支付方式矩阵 ---');
  const pmt = await pool.request().query("SELECT Transaction_Type, Payment_Method, COUNT(*) cnt, SUM(Amount) total FROM Payment_Transaction_Table GROUP BY Transaction_Type, Payment_Method ORDER BY Transaction_Type, Payment_Method");
  pmt.recordset.forEach(r => console.log('  ' + r.Transaction_Type + ' / ' + r.Payment_Method + ': ' + r.cnt + 'x, sum=' + r.total));

  // 7. Notification type coverage
  console.log('\n--- 7. 通知类型覆盖 ---');
  const notif = await pool.request().query("SELECT Notification_Type, COUNT(*) cnt FROM User_Notification GROUP BY Notification_Type ORDER BY Notification_Type");
  notif.recordset.forEach(r => console.log('  ' + r.Notification_Type + ': ' + r.cnt));

  // 8. Points ledger type coverage
  console.log('\n--- 8. 积分流水类型覆盖 ---');
  const pts = await pool.request().query("SELECT Transaction_Type, COUNT(*) cnt FROM Member_Points_Ledger GROUP BY Transaction_Type ORDER BY Transaction_Type");
  pts.recordset.forEach(r => console.log('  ' + r.Transaction_Type + ': ' + r.cnt));

  // Summary
  console.log('\n========================================');
  if (issues.length === 0) {
    console.log('  ALL CHECKS PASSED - 0 issues found');
  } else {
    console.log('  ' + issues.length + ' ISSUES FOUND:');
    issues.forEach(i => console.log('     - ' + i));
  }
  console.log('========================================');

  await pool.close();
}

main().catch(e => { console.error(e); process.exit(1); });

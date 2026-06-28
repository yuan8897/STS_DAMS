/**
 * STS-DAMS 数据缺口填充脚本 (Node.js)
 * 2026-06-04 — 修复 15-fill-data-gaps.sql 中因触发器和SET选项导致的失败
 */
const { getPool, sql } = require('../src/config/db');

async function main() {
  const pool = await getPool();
  console.log('Connected. Starting gap fill...\n');

  // ============================================
  // 1. Create Session 112 (Aborted status)
  // ============================================
  console.log('--- Session 112 (Aborted) ---');
  try {
    // DM=2 (夜雨), Room=4 (现代办公房), Copy=5 (漓川怪谈簿), 12:00-13:30, Aborted
    // DM 2 has shift 12:00-02:00, Script 6 Proficient, Room 4 free
    await pool.request().query(`
      SET IDENTITY_INSERT Fact_Session_Schedule ON;
      INSERT INTO Fact_Session_Schedule (Session_ID, Copy_ID, Room_ID, DM_User_ID,
        Scheduled_Start_Time, Scheduled_End_Time, Session_Status,
        Frozen_Per_Head_Price, Created_By_User_ID)
      VALUES (112, 5, 4, 2,
        '2026-06-04T12:00:00', '2026-06-04T13:30:00', 'Aborted',
        188.00, 1);
      SET IDENTITY_INSERT Fact_Session_Schedule OFF;
    `);
    console.log('  OK: Session 112 created (Aborted).');

    await pool.request().query(`
      INSERT INTO Bridge_Player_Registration (Session_ID, Player_User_ID, Role_ID, Cached_Payment_Status)
      VALUES (112, 5, NULL, 'Fully_Paid'), (112, 8, NULL, 'Unpaid')
    `);
    console.log('  OK: Session 112 registrations added (2 players).');
  } catch (e) {
    console.error('  FAIL Session 112:', e.message.substring(0, 300));
  }

  // ============================================
  // 2. Add Refund payment
  // ============================================
  console.log('--- Payment: Refund ---');
  try {
    const check = await pool.request().query(
      `SELECT COUNT(*) cnt FROM Payment_Transaction_Table WHERE Transaction_Type = 'Refund'`
    );
    if (check.recordset[0].cnt === 0) {
      await pool.request().query(`
        INSERT INTO Payment_Transaction_Table
        (Registration_ID, Transaction_Type, Amount, Payment_Method, Operator_User_ID, Remarks, Processed_At)
        VALUES (1, 'Refund', -100.00, 'WeChat', 1, N'玩家取消参团-退还订金', '2026-06-02T11:00:00')
      `);
      console.log('  OK: Refund payment added.');
    } else {
      console.log('  Skip: Refund already exists.');
    }
  } catch (e) {
    console.error('  FAIL Refund:', e.message.substring(0, 200));
  }

  // ============================================
  // 3. Add Adjustment payment
  // ============================================
  console.log('--- Payment: Adjustment ---');
  try {
    const check = await pool.request().query(
      `SELECT COUNT(*) cnt FROM Payment_Transaction_Table WHERE Transaction_Type = 'Adjustment'`
    );
    if (check.recordset[0].cnt === 0) {
      await pool.request().query(`
        INSERT INTO Payment_Transaction_Table
        (Registration_ID, Transaction_Type, Amount, Payment_Method, Operator_User_ID, Remarks, Processed_At)
        VALUES (5, 'Adjustment', 20.00, 'Cash', 1, N'DM绩效奖励调整', '2026-06-02T18:00:00')
      `);
      console.log('  OK: Adjustment payment added.');
    } else {
      console.log('  Skip: Adjustment already exists.');
    }
  } catch (e) {
    console.error('  FAIL Adjustment:', e.message.substring(0, 200));
  }

  // ============================================
  // 4. Add Member_Balance payment
  // ============================================
  console.log('--- Payment: Member_Balance ---');
  try {
    const check = await pool.request().query(
      `SELECT COUNT(*) cnt FROM Payment_Transaction_Table WHERE Payment_Method = 'Member_Balance'`
    );
    if (check.recordset[0].cnt === 0) {
      await pool.request().query(`
        INSERT INTO Payment_Transaction_Table
        (Registration_ID, Transaction_Type, Amount, Payment_Method, Operator_User_ID, Remarks, Processed_At)
        VALUES (7, 'Final_Payment', 88.00, 'Member_Balance', 3, N'使用会员积分抵扣后余额支付', '2026-06-03T15:00:00')
      `);
      console.log('  OK: Member_Balance payment added.');
    } else {
      console.log('  Skip: Member_Balance already exists.');
    }
  } catch (e) {
    console.error('  FAIL Member_Balance:', e.message.substring(0, 200));
  }

  // ============================================
  // 5. Verify Cover_Image_URL and Avatar_Image_URL
  // ============================================
  console.log('--- Image URLs ---');
  const covers = await pool.request().query(
    `SELECT Script_ID, Script_Title, Cover_Image_URL FROM Dim_Script_Dictionary ORDER BY Script_ID`
  );
  covers.recordset.forEach(s => console.log(`  Script ${s.Script_ID} (${s.Script_Title}): ${s.Cover_Image_URL || 'NULL'}`));

  const avatars = await pool.request().query(
    `SELECT DM_User_ID, DM_Stage_Name, Avatar_Image_URL FROM DM_Profile_Table ORDER BY DM_User_ID`
  );
  avatars.recordset.forEach(d => console.log(`  DM ${d.DM_User_ID} (${d.DM_Stage_Name}): ${d.Avatar_Image_URL || 'NULL'}`));

  // ============================================
  // 6. Final verification
  // ============================================
  console.log('\n========================================');
  console.log('  FINAL DATABASE STATE');
  console.log('========================================');
  const r = await pool.request().query(`
    SELECT '1_Accounts' tbl, COUNT(*) cnt FROM Account_Base_Table UNION ALL
    SELECT '2_Sessions', COUNT(*) FROM Fact_Session_Schedule UNION ALL
    SELECT '3_Registrations', COUNT(*) FROM Bridge_Player_Registration UNION ALL
    SELECT '4_Payment_Tx', COUNT(*) FROM Payment_Transaction_Table UNION ALL
    SELECT '5_Consumptions', COUNT(*) FROM Fact_Session_Consumption UNION ALL
    SELECT '6_Inv_Movements', COUNT(*) FROM Inventory_Movement_Ledger UNION ALL
    SELECT '7_Discount_Usage', COUNT(*) FROM Discount_Usage_Log UNION ALL
    SELECT '8_Audit_Logs', COUNT(*) FROM System_Audit_Log_Table UNION ALL
    SELECT '9_KPI_Snaps', COUNT(*) FROM Daily_KPI_Snapshot UNION ALL
    SELECT '10_LTV_Snaps', COUNT(*) FROM Daily_User_LTV_Snapshot UNION ALL
    SELECT '11_Notifications', COUNT(*) FROM User_Notification UNION ALL
    SELECT '12_Reviews', COUNT(*) FROM Fact_Session_Review UNION ALL
    SELECT '13_Coupons', COUNT(*) FROM User_Coupon_Instance UNION ALL
    SELECT '14_Points_Ledger', COUNT(*) FROM Member_Points_Ledger UNION ALL
    SELECT '15_DM_Shifts', COUNT(*) FROM DM_Shift_Availability_Table
    ORDER BY tbl
  `);
  r.recordset.forEach(x => console.log(`  ${x.tbl}: ${x.cnt}`));

  await pool.close();
  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });

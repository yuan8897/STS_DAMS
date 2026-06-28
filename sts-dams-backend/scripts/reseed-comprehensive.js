/**
 * 完整种子数据重置脚本
 * 清理现有数据 → 重新导入丰富、正确的种子数据
 *
 * 运行方式: node scripts/reseed-comprehensive.js
 */

const { getPool, sql } = require('../src/config/db');

async function reseed() {
  const pool = await getPool();
  console.log('Connected to SQL Server (STS_DAMS)\n');

  try {
    // ================================================================
    // 第一步：撤销写保护 + 按外键依赖顺序清理所有数据
    // ================================================================
    console.log('=== 第一步：清理现有数据 ===\n');

    // 先撤销 10-permissions-seed.sql 中施加的 DENY 写保护
    const protectedTables = ['Payment_Transaction_Table', 'Fact_Session_Consumption', 'Inventory_Movement_Ledger', 'System_Audit_Log_Table'];
    for (const table of protectedTables) {
      try {
        await pool.request().query(`REVOKE DELETE ON ${table} FROM PUBLIC`);
        await pool.request().query(`REVOKE UPDATE ON ${table} FROM PUBLIC`);
      } catch (e) { /* 权限可能不存在，忽略 */ }
    }
    console.log('  已撤销财务/审计表写保护');

    // 禁用所有外键约束，避免交叉引用导致删除失败
    console.log('  禁用外键约束...');
    const fkResult = await pool.request().query(`
      SELECT
        fk.name AS FK_Name,
        OBJECT_NAME(fk.parent_object_id) AS Table_Name
      FROM sys.foreign_keys fk
    `);
    for (const row of fkResult.recordset) {
      try {
        await pool.request().query(`ALTER TABLE ${row.Table_Name} NOCHECK CONSTRAINT ${row.FK_Name}`);
      } catch (e) { /* 忽略 */ }
    }
    console.log(`  已禁用 ${fkResult.recordset.length} 个外键约束\n`);

    // 禁用外键后，可以按任意顺序删除所有表
    const allTables = [
      'Fact_Session_Review', 'Member_Points_Ledger', 'User_Coupon_Instance',
      'User_Member_Profile', 'User_Notification', 'Payment_Transaction_Table',
      'Bridge_Player_Registration', 'Fact_Session_Consumption', 'Inventory_Movement_Ledger',
      'System_Audit_Log_Table', 'Daily_KPI_Snapshot', 'Daily_User_LTV_Snapshot',
      'Fact_Session_Schedule', 'DM_Shift_Availability_Table', 'DM_Script_Capability_Table',
      'Asset_Script_Copy_Table', 'Script_Role_Definition_Table', 'Coupon_Template',
      'Dim_Script_Dictionary', 'DM_Profile_Table', 'Dim_Inventory_Item',
      'Dim_Store_Room', 'Dim_Member_Level', 'Dim_Store_Info', 'Account_Base_Table',
    ];

    for (const table of allTables) {
      try {
        const r = await pool.request().query(`DELETE FROM ${table}`);
        console.log(`  ✓ ${table} (${r.rowsAffected[0]} 行已删除)`);
      } catch (e) {
        console.log(`  ⚠ ${table}: ${e.message}`);
      }
    }

    // 重置所有 IDENTITY 列（DELETE 不重置自增种子）
    const identityTables = [
      'Account_Base_Table', 'Dim_Store_Room', 'Dim_Script_Dictionary',
      'Script_Role_Definition_Table', 'Asset_Script_Copy_Table',
      'Dim_Inventory_Item', 'Dim_Member_Level', 'Coupon_Template',
      'Fact_Session_Schedule', 'Bridge_Player_Registration',
      'User_Coupon_Instance', 'Fact_Session_Review',
      'Fact_Session_Consumption', 'Payment_Transaction_Table',
    ];
    console.log('\n  重置 IDENTITY 种子...');
    for (const table of identityTables) {
      try {
        await pool.request().query(`DBCC CHECKIDENT ('${table}', RESEED, 0)`);
      } catch (e) { /* 某些表可能不是 IDENTITY */ }
    }

    console.log('\n=== 第二步：导入种子数据 ===\n');

    // ================================================================
    // 第二步：导入完整种子数据
    // ================================================================

    // --- 2.1 账户 ---
    console.log('  导入账户...');
    await pool.request().query(`
      SET IDENTITY_INSERT Account_Base_Table ON;
      INSERT INTO Account_Base_Table (User_ID, Account_Name, Password_Hash, Contact_Phone, Role_Type, Account_Status)
      VALUES
        (1, 'admin',   HASHBYTES('SHA2_256', '123456'), '+8613800000001', 3, 'Active'),
        (2, 'dm_ye',   HASHBYTES('SHA2_256', '123456'), '+8613800000002', 2, 'Active'),
        (3, 'dm_chen', HASHBYTES('SHA2_256', '123456'), '+8613800000003', 2, 'Active'),
        (4, 'dm_lin',  HASHBYTES('SHA2_256', '123456'), '+8613800000004', 2, 'Active'),
        (5, 'player_xiaoming', HASHBYTES('SHA2_256', '123456'), '+8613800000005', 1, 'Active'),
        (6, 'player_hong',     HASHBYTES('SHA2_256', '123456'), '+8613800000006', 1, 'Active'),
        (7, 'player_lily',     HASHBYTES('SHA2_256', '123456'), '+8613800000007', 1, 'Active'),
        (8, 'player_david',    HASHBYTES('SHA2_256', '123456'), '+8613800000008', 1, 'Active');
      SET IDENTITY_INSERT Account_Base_Table OFF;
    `);

    // --- 2.2 DM 档案 ---
    console.log('  导入 DM 档案...');
    await pool.request().query(`
      INSERT INTO DM_Profile_Table (DM_User_ID, DM_Stage_Name, Base_Per_Session_Wage, Employment_Status, Hire_Date)
      VALUES
        (2, N'夜雨',   150.00, 'Active', '2025-06-01'),
        (3, N'沉渊',   120.00, 'Active', '2025-09-15'),
        (4, N'林深',   180.00, 'Active', '2026-03-01');
    `);

    // --- 2.3 门店信息 ---
    console.log('  导入门店信息...');
    await pool.request().query(`
      INSERT INTO Dim_Store_Info (Store_ID, Store_Name, Store_Address, Contact_Phone, Contact_Email, Business_Hours)
      VALUES (1, N'STS 剧本杀推理馆', N'上海市黄浦区南京东路 128 号 3F', '021-6888-0001', 'contact@sts-dams.cn', N'周一至周五 12:00-02:00 / 周末 10:00-02:00');
    `);

    // --- 2.4 房间 ---
    console.log('  导入房间...');
    await pool.request().query(`
      SET IDENTITY_INSERT Dim_Store_Room ON;
      INSERT INTO Dim_Store_Room (Room_ID, Room_Name, Room_Max_Capacity, Room_Theme, Room_Operating_Status)
      VALUES
        (1, N'日式和风房',   8, N'和风',    'Operational'),
        (2, N'欧式古堡房',   8, N'哥特',    'Operational'),
        (3, N'民国老上海房', 8, N'民国',    'Operational'),
        (4, N'现代办公房',   8, N'现代办公', 'Operational'),
        (5, N'恐怖密室房',   7, N'恐怖',    'Under_Maintenance');
      SET IDENTITY_INSERT Dim_Store_Room OFF;
    `);

    // --- 2.5 剧本 ---
    console.log('  导入剧本...');
    await pool.request().query(`
      SET IDENTITY_INSERT Dim_Script_Dictionary ON;
      INSERT INTO Dim_Script_Dictionary (Script_ID, Script_Title, Min_Required_Players, Max_Allowed_Players, Estimated_Duration, Base_Price, Primary_Genre, Is_Retired)
      VALUES
        (1, N'昆仑',             4, 7, 300, 198.00, 6, 0),
        (2, N'被嫌弃的松子的一生', 3, 6, 240, 168.00, 2, 0),
        (3, N'第七号嫌疑人',      3, 5, 210, 188.00, 3, 0),
        (4, N'来电',             4, 8, 240, 158.00, 4, 0),
        (5, N'雪乡杀人事件',      3, 6, 270, 178.00, 1, 0),
        (6, N'漓川怪谈簿',        3, 7, 270, 188.00, 7, 0);
      SET IDENTITY_INSERT Dim_Script_Dictionary OFF;
    `);

    // --- 2.6 剧本角色 ---
    console.log('  导入剧本角色...');
    await pool.request().query(`
      INSERT INTO Script_Role_Definition_Table (Script_ID, Role_Name, Gender_Restriction, Role_Description)
      VALUES
        (1, N'李探长',    'Male',   N'心思缜密的私家侦探，游走于京城各大案件之间'),
        (1, N'夜半歌姬',  'Female', N'秦淮河畔的神秘歌女，身世成谜，知情甚多'),
        (1, N'昆仑道人',  'Male',   N'隐居昆仑山中的修道之人，通晓天地玄机'),
        (1, N'白芷',      'Female', N'医术高超的女大夫，善用草药，妙手回春'),
        (1, N'铁剑客',    'Male',   N'剑术独步天下的侠客，沉默寡言却义薄云天'),
        (1, N'紫烟',      'Female', N'擅长易容术的江湖奇女子，千面玲珑'),
        (1, N'冷面将军',  'Any',    N'戍守边关的威严将军，忠肝义胆'),
        (2, N'松子',        'Female', N'温柔而坚韧的女主角，一生追寻爱与温暖'),
        (2, N'作家',        'Male',   N'以松子故事为蓝本的落魄作家，笔下有情'),
        (2, N'松子之妹',    'Female', N'默默守护松子的妹妹，姐妹情深'),
        (2, N'初恋男友',    'Male',   N'松子最初的恋人，命运的转折点'),
        (3, N'刑警队长',    'Male',   N'负责调查案件的刑警队长，经验丰富'),
        (3, N'法医',        'Female', N'资深女法医，用科学揭开真相'),
        (3, N'嫌疑人A',     'Male',   N'被指控的关键嫌疑人，身上疑点重重'),
        (3, N'目击证人',    'Female', N'案发当天的目击证人，记忆中存在盲区'),
        (4, N'主持人',      'Any', N'《来电》节目的灵魂主持人，掌控全场节奏'),
        (4, N'玩家A',       'Any', N'被选中的幸运玩家，带着故事走进演播厅'),
        (4, N'玩家B',       'Any', N'被选中的幸运玩家，隐藏着不为人知的秘密'),
        (4, N'玩家C',       'Any', N'被选中的幸运玩家，性格鲜明敢爱敢恨'),
        (4, N'玩家D',       'Any', N'被选中的幸运玩家，沉默中暗藏玄机'),
        (5, N'民宿老板娘',  'Female', N'雪乡民宿老板娘，热情好客却心事重重'),
        (5, N'背包客',      'Male',   N'独自旅行的背包客，偶然闯入雪乡的世界'),
        (5, N'摄影师',      'Female', N'热爱雪乡的摄影师，镜头下捕捉不寻常的画面'),
        (6, N'巫女',        'Female', N'掌管漓川神社的巫女，与神灵对话'),
        (6, N'阴阳师',      'Male',   N'来自京都的阴阳师，驱邪除魔'),
        (6, N'画师',        'Male',   N'痴迷怪谈的画师，绘出不可名状之物'),
        (6, N'茶屋侍女',    'Female', N'隐藏身份的神秘侍女，知晓神社秘密'),
        (6, N'神官',        'Male',   N'恪守教条的神官，守护神社秩序');
    `);

    // --- 2.7 剧本副本 ---
    console.log('  导入剧本副本...');
    await pool.request().query(`
      SET IDENTITY_INSERT Asset_Script_Copy_Table ON;
      INSERT INTO Asset_Script_Copy_Table (Copy_ID, Copy_Asset_Barcode, Script_ID, Authorization_Type, Asset_Condition, Purchase_Date, Current_Storage_Location)
      VALUES
        (1, 'BARCODE-KL-001', 1, 'Boxed',          'Perfect', '2025-06-15', N'前台储物柜 A-3'),
        (2, 'BARCODE-SZ-001', 2, 'Exclusive',      'Worn',    '2025-07-20', N'前台储物柜 B-1'),
        (3, 'BARCODE-QH-001', 3, 'Boxed',          'Perfect', '2025-11-10', N'前台储物柜 C-2'),
        (4, 'BARCODE-LD-001', 4, 'Boxed',          'Perfect', '2026-01-05', N'前台储物柜 D-1'),
        (5, 'BARCODE-LJ-001', 6, 'One_Of_A_Kind',  'Perfect', '2025-10-01', N'前台储物柜 E-1');
      SET IDENTITY_INSERT Asset_Script_Copy_Table OFF;
    `);

    // --- 2.8 DM 能力 ---
    console.log('  导入 DM 能力...');
    await pool.request().query(`
      INSERT INTO DM_Script_Capability_Table (DM_User_ID, Script_ID, Proficiency_Level, Certified_At)
      VALUES
        (2, 1, 'Expert',     '2025-06-15T00:00:00'),
        (2, 2, 'Proficient', '2025-09-01T00:00:00'),
        (2, 3, 'Proficient', '2025-12-01T00:00:00'),
        (2, 6, 'Proficient', '2026-01-15T00:00:00'),
        (3, 3, 'Expert',     '2025-11-01T00:00:00'),
        (3, 4, 'Proficient', '2026-01-05T00:00:00'),
        (3, 6, 'Proficient', '2026-02-15T00:00:00'),
        (4, 2, 'Trained',    '2025-07-01T00:00:00'),
        (4, 4, 'Trained',    '2026-01-15T00:00:00'),
        (4, 5, 'Expert',     '2025-09-01T00:00:00'),
        (4, 6, 'Trained',    '2026-02-01T00:00:00');
    `);

    // --- 2.9 商品库存 ---
    console.log('  导入商品库存...');
    await pool.request().query(`
      SET IDENTITY_INSERT Dim_Inventory_Item ON;
      INSERT INTO Dim_Inventory_Item (Item_ID, Item_Name, Current_Stock_Cache, Cost_Unit_Price, Selling_Unit_Price, Item_Category, Safety_Alert_Threshold)
      VALUES
        (1, N'进口可乐',               120, 3.50,  10.00, N'饮料',    20),
        (2, N'进口雪碧',                80, 3.50,  10.00, N'饮料',    15),
        (3, N'矿泉水',                  60, 1.00,   5.00, N'饮料',    20),
        (4, N'薯片（大包）',             40, 6.00,  15.00, N'零食',    10),
        (5, N'话梅',                    15, 4.00,  10.00, N'零食',     5),
        (6, N'剧本配套信封耗材',          40, 2.00,   5.00, N'剧本耗材', 15),
        (7, N'一次性主题服饰内衬',       80, 1.50,   5.00, N'道具服饰', 20);
      SET IDENTITY_INSERT Dim_Inventory_Item OFF;
    `);

    // --- 2.10 DM 排班 (2026-06-02 ~ 2026-06-05) ---
    console.log('  导入 DM 排班...');
    await pool.request().query(`
      INSERT INTO DM_Shift_Availability_Table (DM_User_ID, Available_Start, Available_End, Shift_Type)
      VALUES
        -- DM 夜雨: 午班 12:00-02:00（次日）
        (2, '2026-06-02T12:00:00', '2026-06-03T02:00:00', 'Regular'),
        (2, '2026-06-03T12:00:00', '2026-06-04T02:00:00', 'Regular'),
        (2, '2026-06-04T12:00:00', '2026-06-05T02:00:00', 'Regular'),
        -- DM 沉渊: 下午班 14:00-01:00（次日）—— 对齐场次时间，避免触发器冲突
        (3, '2026-06-02T14:00:00', '2026-06-03T01:00:00', 'Regular'),
        (3, '2026-06-03T14:00:00', '2026-06-04T01:00:00', 'Regular'),
        (3, '2026-06-04T14:00:00', '2026-06-05T01:00:00', 'Regular'),
        -- DM 林深: 午班 14:00-00:00
        (4, '2026-06-02T14:00:00', '2026-06-03T00:00:00', 'Regular'),
        (4, '2026-06-03T14:00:00', '2026-06-04T00:00:00', 'Regular'),
        (4, '2026-06-04T14:00:00', '2026-06-05T00:00:00', 'Regular');
    `);

    // --- 2.11 会员等级 ---
    console.log('  导入会员等级...');
    await pool.request().query(`
      SET IDENTITY_INSERT Dim_Member_Level ON;
      INSERT INTO Dim_Member_Level (Level_ID, Level_Name, Min_Required_Points, Discount_Rate, Point_Earning_Multiplier)
      VALUES
        (1, 'Bronze',   0,     1.000, 1.00),
        (2, 'Silver',   500,   0.980, 1.05),
        (3, 'Gold',     2000,  0.950, 1.10),
        (4, 'Platinum', 5000,  0.920, 1.20),
        (5, 'Diamond',  12000, 0.880, 1.35);
      SET IDENTITY_INSERT Dim_Member_Level OFF;
    `);

    // --- 2.12 优惠券模板 ---
    console.log('  导入优惠券模板...');
    await pool.request().query(`
      SET IDENTITY_INSERT Coupon_Template ON;
      INSERT INTO Coupon_Template (Template_ID, Coupon_Name, Discount_Type, Discount_Value, Min_Order_Amount, Max_Discount_Cap, Valid_Days_From_Issue, Applicable_Script_ID, Total_Issuance_Limit, Per_User_Limit, Is_Active, Created_By_User_ID, Created_At)
      VALUES
        (1, N'新人专享8折券',       'Percent_Off',  0.20, 0,   30.00, 30, NULL, 100, 1, 1, 1, '2026-01-01T00:00:00'),
        (2, N'满200减30',           'Fixed_Amount', 30.00, 200, NULL,  60, NULL, NULL,3, 1, 1, '2026-02-01T00:00:00'),
        (3, N'《昆仑》尝鲜9折券',   'Percent_Off',  0.10, 0,   20.00, 15, 1,    50,  1, 1, 1, '2026-03-01T00:00:00');
      SET IDENTITY_INSERT Coupon_Template OFF;
    `);

    // --- 2.13 场次数据 (2026-06-02 和 2026-06-03) ---
    console.log('  导入场次数据...');
    await pool.request().query(`
      SET IDENTITY_INSERT Fact_Session_Schedule ON;
      INSERT INTO Fact_Session_Schedule (Session_ID, Copy_ID, Room_ID, DM_User_ID, Scheduled_Start_Time, Scheduled_End_Time, Session_Status, Frozen_Per_Head_Price, Created_By_User_ID)
      VALUES
        -- 6月2日
        (101, 1, 1, 2, '2026-06-02T14:00:00', '2026-06-02T19:00:00', 'Completed',      198.00, 1),
        (102, 2, 2, 4, '2026-06-02T14:00:00', '2026-06-02T18:00:00', 'Completed',      168.00, 1),
        (103, 3, 3, 3, '2026-06-02T18:00:00', '2026-06-02T22:30:00', 'Completed',      188.00, 1),
        (104, 4, 4, 4, '2026-06-02T19:00:00', '2026-06-02T23:00:00', 'Locked_Ready',   158.00, 1),
        -- 6月3日
        (105, 1, 1, 2, '2026-06-03T14:00:00', '2026-06-03T19:00:00', 'Matching',       198.00, 1),
        (106, 5, 5, 3, '2026-06-03T15:00:00', '2026-06-03T19:30:00', 'Matching',       188.00, 1),
        (107, 2, 2, 4, '2026-06-03T18:00:00', '2026-06-03T22:00:00', 'Matching',       168.00, 1),
        (108, 3, 4, 2, '2026-06-03T19:00:00', '2026-06-03T22:30:00', 'In_Progress',   188.00, 1);
      SET IDENTITY_INSERT Fact_Session_Schedule OFF;
    `);

    // --- 2.14 参团登记 ---
    console.log('  导入参团登记...');
    await pool.request().query(`
      INSERT INTO Bridge_Player_Registration (Session_ID, Player_User_ID, Role_ID, Cached_Payment_Status)
      VALUES
        -- Session 101 (昆仑, 已完成)
        (101, 5, NULL, 'Deposit_Paid'), (101, 6, 6, 'Fully_Paid'), (101, 7, 1, 'Unpaid'),
        -- Session 102 (松子, 已完成)
        (102, 5, 8, 'Fully_Paid'),     (102, 8, NULL, 'Unpaid'),
        -- Session 103 (嫌疑人, 已完成)
        (103, 5, 13, 'Fully_Paid'),    (103, 6, 15, 'Fully_Paid'),
        (103, 7, 14, 'Fully_Paid'),    (103, 8, 12, 'Deposit_Paid'),
        -- Session 104 (来电, 锁车待开)
        (104, 5, NULL, 'Fully_Paid'),  (104, 6, NULL, 'Fully_Paid'), (104, 7, NULL, 'Deposit_Paid'),
        -- Session 105 (昆仑, 拼车中)
        (105, 5, 1, 'Fully_Paid'),     (105, 6, NULL, 'Unpaid'),    (105, 8, 3, 'Deposit_Paid'),
        -- Session 106 (漓川怪谈簿, 拼车中)
        (106, 7, NULL, 'Fully_Paid'),  (106, 8, NULL, 'Unpaid'),
        -- Session 107 (松子, 拼车中)
        (107, 5, NULL, 'Fully_Paid'),  (107, 7, NULL, 'Deposit_Paid'),
        -- Session 108 (嫌疑人, 进行中)
        (108, 6, 14, 'Fully_Paid'),    (108, 7, 13, 'Fully_Paid'), (108, 8, 15, 'Fully_Paid');
    `);

    // --- 2.15 会员档案 ---
    console.log('  导入会员档案...');
    await pool.request().query(`
      INSERT INTO User_Member_Profile (User_ID, Accumulated_Points, Current_Level_ID, Total_Lifetime_Points, Level_Upgraded_At)
      VALUES
        (5, 2350, 3, 2850, '2026-06-02T08:00:00'),
        (6, 680,  2, 780,  '2026-06-02T09:00:00'),
        (7, 200,  1, 300,  NULL),
        (8, 5800, 4, 6200, '2026-06-02T10:00:00');
    `);

    // --- 2.16 积分流水 ---
    console.log('  导入积分流水...');
    await pool.request().query(`
      INSERT INTO Member_Points_Ledger (User_ID, Points_Delta, Transaction_Type, Related_Session_ID, Points_Balance_After, Operator_User_ID, Remarks, Created_At)
      VALUES
        (5, 100,  'Earn_Session',      101, 2350, 1, NULL,                         '2026-06-02T14:00:00'),
        (5, 50,   'Earn_Consumption',  103, 2250, 2, NULL,                         '2026-06-02T18:30:00'),
        (5, -500, 'Redeem_Cash',       NULL, 2200, 2, N'积分兑换抵扣 ¥5.00',       '2026-06-02T14:30:00'),
        (6, 100,  'Earn_Session',      103, 680,  1, NULL,                         '2026-06-02T13:00:00'),
        (6, 60,   'Earn_Consumption',  103, 580,  2, NULL,                         '2026-06-02T19:00:00'),
        (7, 100,  'Earn_Session',      101, 200,  1, NULL,                         '2026-06-02T14:00:00'),
        (8, 100,  'Earn_Session',      103, 5800, 1, NULL,                         '2026-06-02T13:00:00'),
        (8, -1000,'Redeem_Cash',       NULL, 5700, 2, N'积分兑换抵扣 ¥10.00',      '2026-06-02T15:00:00');
    `);

    // --- 2.17 优惠券实例 ---
    console.log('  导入优惠券实例...');
    await pool.request().query(`
      SET IDENTITY_INSERT User_Coupon_Instance ON;
      INSERT INTO User_Coupon_Instance (Coupon_ID, Template_ID, User_ID, Coupon_Status, Issued_At, Expires_At, Used_At, Issued_By_User_ID)
      VALUES
        (1, 1, 7, 'Unused',  '2026-05-20T00:00:00', '2026-06-19T23:59:59', NULL,                     1),
        (2, 1, 8, 'Used',    '2026-05-10T00:00:00', '2026-06-09T23:59:59', '2026-05-25T00:00:00',     1),
        (3, 2, 5, 'Unused',  '2026-05-01T00:00:00', '2026-06-30T23:59:59', NULL,                     1),
        (4, 3, 6, 'Unused',  '2026-05-15T00:00:00', '2026-06-14T23:59:59', NULL,                     1),
        (5, 2, 8, 'Expired', '2026-04-01T00:00:00', '2026-05-01T23:59:59', NULL,                     1);
      SET IDENTITY_INSERT User_Coupon_Instance OFF;
    `);

    // --- 2.18 服务评价 ---
    console.log('  导入服务评价...');
    await pool.request().query(`
      SET IDENTITY_INSERT Fact_Session_Review ON;
      INSERT INTO Fact_Session_Review (Review_ID, Session_ID, Reviewer_User_ID, Registration_ID, DM_Rating, Script_Rating, Room_Rating, Overall_Rating, Review_Comment, Tags, Is_Anonymous, Created_At)
      VALUES
        (1, 101, 5, 1, 5, 4, 4, 4, N'夜雨DM带场非常专业，沉浸感很强！昆仑的推理设计精妙绝伦。',               N'DM入戏深,氛围感强',                             0, '2026-06-02T19:30:00'),
        (2, 101, 6, 2, 4, 5, 4, 5, N'昆仑剧本太精彩了，推理层层递进，每个角色都有深度！',                     N'推理烧脑,DM入戏深',                             0, '2026-06-02T19:45:00'),
        (3, 102, 5, 4, 5, 5, 3, 4, N'松子的故事太催泪了，哭到停不下来，林深DM情感引导非常到位',            N'情感催泪',                                       1, '2026-06-02T18:15:00'),
        (4, 103, 5, 6, 5, 5, 4, 5, N'沉渊DM演技炸裂，案件设计巧妙，民国氛围营造满分，强烈推荐！',          N'推理烧脑,DM入戏深,氛围感强',                    0, '2026-06-02T22:45:00'),
        (5, 103, 6, 7, 4, 4, 5, 4, N'房间布置很有民国氛围，道具精致，体验非常棒',                           N'氛围感强',                                       0, '2026-06-02T23:00:00'),
        (6, 103, 8, 9, 5, 5, 5, 5, N'年度最佳剧本杀体验！沉渊DM全程高能，各方面都完美',                     N'推理烧脑,DM入戏深,氛围感强',                    0, '2026-06-02T23:15:00');
      SET IDENTITY_INSERT Fact_Session_Review OFF;
    `);

    // --- 2.19 消费记录 ---
    console.log('  导入消费记录...');
    await pool.request().query(`
      SET IDENTITY_INSERT Fact_Session_Consumption ON;
      INSERT INTO Fact_Session_Consumption (Consumption_ID, Store_ID, Session_ID, Item_ID, Consumed_Quantity, Unit_Price_At_Sale, Line_Total_Cost, Recording_DM_User_ID, Recorded_At)
      VALUES
        (1, 1, 103, 1, 3, 10.00, 30.00, 2, '2026-06-02T18:30:00'),
        (2, 1, 103, 4, 2, 15.00, 30.00, 2, '2026-06-02T19:00:00'),
        (3, 1, 101, 3, 4, 5.00,  20.00, 2, '2026-06-02T16:30:00'),
        (4, 1, 102, 1, 2, 10.00, 20.00, 4, '2026-06-02T15:00:00');
      SET IDENTITY_INSERT Fact_Session_Consumption OFF;
    `);

    // --- 2.20 支付记录 ---
    console.log('  导入支付记录...');
    // 临时禁用触发器（QUOTED_IDENTIFIER 与 indexed views 冲突）
    await pool.request().query(`DISABLE TRIGGER trg_Payment_SyncCachedStatus ON Payment_Transaction_Table`);
    await pool.request().query(`
      INSERT INTO Payment_Transaction_Table (Store_ID, Registration_ID, Transaction_Type, Amount, Payment_Method, Processed_At, Operator_User_ID)
      VALUES
        (1, 1,  'Deposit',      100.00, 'WeChat', '2026-06-02T09:30:00', 1),
        (1, 2,  'Final_Payment', 198.00, 'Alipay', '2026-06-02T09:45:00', 1),
        (1, 4,  'Final_Payment', 168.00, 'Alipay', '2026-06-02T10:30:00', 1),
        (1, 6,  'Final_Payment', 188.00, 'WeChat', '2026-06-02T13:00:00', 1),
        (1, 7,  'Final_Payment', 188.00, 'Alipay', '2026-06-02T13:15:00', 1),
        (1, 8,  'Final_Payment', 188.00, 'WeChat', '2026-06-02T13:30:00', 1),
        (1, 9,  'Deposit',      100.00, 'Bank_Card', '2026-06-02T14:00:00', 1),
        (1, 10, 'Final_Payment', 158.00, 'WeChat', '2026-06-02T08:00:00', 1),
        (1, 11, 'Final_Payment', 158.00, 'Alipay', '2026-06-02T08:30:00', 1);
    `);

    // --- 2.21 库存流水 ---
    console.log('  导入库存流水...');
    await pool.request().query(`
      INSERT INTO Inventory_Movement_Ledger (Item_ID, Quantity_Delta, Movement_Type, Related_Session_ID, Operator_User_ID, Movement_Reason, Movement_At)
      VALUES
        (1, 120, 'Initial_Stock',  NULL, 1, N'系统初始化-期初建账', '2026-01-01T00:00:00'),
        (2, 80,  'Initial_Stock',  NULL, 1, N'系统初始化-期初建账', '2026-01-01T00:00:00'),
        (3, 60,  'Initial_Stock',  NULL, 1, N'系统初始化-期初建账', '2026-01-01T00:00:00'),
        (4, 40,  'Initial_Stock',  NULL, 1, N'系统初始化-期初建账', '2026-01-01T00:00:00'),
        (5, 15,  'Initial_Stock',  NULL, 1, N'系统初始化-期初建账', '2026-01-01T00:00:00'),
        (6, 40,  'Initial_Stock',  NULL, 1, N'系统初始化-期初建账', '2026-01-01T00:00:00'),
        (7, 80,  'Initial_Stock',  NULL, 1, N'系统初始化-期初建账', '2026-01-01T00:00:00'),
        (1, -3,  'Sale_Out',       103,  2, N'场次消费-第七号嫌疑人', '2026-06-02T18:30:00'),
        (4, -2,  'Sale_Out',       103,  2, N'场次消费-第七号嫌疑人', '2026-06-02T19:00:00'),
        (3, -4,  'Sale_Out',       101,  2, N'场次消费-昆仑',         '2026-06-02T16:30:00'),
        (1, -2,  'Sale_Out',       102,  4, N'场次消费-松子',         '2026-06-02T15:00:00');
    `);

    // --- 2.22 消息通知（覆盖所有用户！） ---
    console.log('  导入消息通知（全部用户）...');
    await pool.request().query(`
      INSERT INTO User_Notification (Recipient_User_ID, Notification_Type, Title, Content, Related_Entity_Type, Related_Entity_ID, Is_Read, Created_At)
      VALUES
        -- Admin (User_ID=1) 通知
        (1, 'Low_Stock_Alert',  N'库存预警',     N'商品「话梅」当前库存仅剩 15 件，低于安全预警红线 5 件，请及时补货',  'Dim_Inventory_Item',     '5',   0, '2026-06-03T08:00:00'),
        (1, 'Session_Reminder',N'流局风险',     N'《来电》场次开场前 2 小时人数不足，当前仅 3 人注册，风险等级：中',       'Fact_Session_Schedule', '104',  0, '2026-06-02T17:00:00'),
        (1, 'System_Announce', N'系统通知',     N'6月2日门店数据已汇总完毕：昨日完成 3 场，总营收 ¥1,644，会员新增 0 人。', NULL,                     NULL,  0, '2026-06-03T09:00:00'),

        -- DM 夜雨 (User_ID=2) 通知
        (2, 'Session_Reminder', N'新场次分配',  N'你被分配到 6月3日 14:00 《昆仑》日式和风房场次，当前状态：拼车中',        'Fact_Session_Schedule', '105',  0, '2026-06-02T20:00:00'),
        (2, 'Session_Reminder', N'场次即将开始', N'今天 14:00 《昆仑》日式和风房即将开场，请提前 15 分钟到场准备',          'Fact_Session_Schedule', '105',  0, '2026-06-03T13:45:00'),
        (2, 'Session_Reminder', N'新场次分配',  N'你被分配到 6月3日 19:00 《第七号嫌疑人》现代办公房场次，当前状态：进行中',  'Fact_Session_Schedule', '108',  0, '2026-06-02T20:00:00'),
        (2, 'Review_Request',  N'收到新评价',   N'你的昆仑场次（Session#101）收到了 2 条新评价，平均评分 4.5/5',           'Fact_Session_Review',   '1',    0, '2026-06-02T19:50:00'),

        -- DM 沉渊 (User_ID=3) 通知
        (3, 'Session_Reminder', N'新场次分配',  N'你被分配到 6月3日 15:00 《漓川怪谈簿》恐怖密室房场次，当前状态：拼车中',    'Fact_Session_Schedule', '106',  0, '2026-06-02T20:00:00'),
        (3, 'Session_Reminder', N'场次已完成',  N'《第七号嫌疑人》场次（Session#103）已结束，请及时提交消费记账',           'Fact_Session_Schedule', '103',  0, '2026-06-02T23:00:00'),
        (3, 'Review_Request',  N'收到新评价',   N'你的第七号嫌疑人场次（Session#103）收到了 3 条新评价，平均评分 4.7/5！',    'Fact_Session_Review',   '4',    0, '2026-06-03T08:00:00'),

        -- DM 林深 (User_ID=4) 通知
        (4, 'Session_Reminder', N'新场次分配',  N'你被分配到 6月3日 18:00 《被嫌弃的松子的一生》欧式古堡房场次，当前状态：拼车中','Fact_Session_Schedule','107', 0, '2026-06-02T20:00:00'),
        (4, 'Session_Reminder', N'场次即将开始', N'今天 18:00 《被嫌弃的松子的一生》欧式古堡房即将开场，请提前准备',        'Fact_Session_Schedule', '107',  0, '2026-06-03T17:45:00'),
        (4, 'Review_Request',  N'收到新评价',   N'你的松子场次（Session#102）收到了 1 条评价，评分 4/5',                   'Fact_Session_Review',   '3',    0, '2026-06-02T18:20:00'),

        -- player_xiaoming (User_ID=5) 通知
        (5, 'Session_Reminder', N'新场次发布',  N'今晚 19:00 《来电》现代办公房正在拼车中！DM：林深，价格 ¥158/人',         'Fact_Session_Schedule', '104',  0, '2026-06-02T07:00:00'),
        (5, 'Session_Reminder', N'拼车成功',    N'你参团的《第七号嫌疑人》已锁车！请于 18:00 前到达民国老上海房',          'Fact_Session_Schedule', '103',  0, '2026-06-02T14:30:00'),
        (5, 'Payment_Confirm',  N'支付确认',    N'你在《第七号嫌疑人》场次的支付 ¥188.00 已确认，享受 Gold 会员 9.5 折',     'Payment_Transaction_Table','6',  0, '2026-06-02T13:05:00'),
        (5, 'Coupon_Issued',   N'优惠券到账',   N'「满200减30」优惠券已发放到你的账户，有效期至 2026-06-30，快去看看吧！',   'User_Coupon_Instance',  '3',    0, '2026-05-01T10:00:00'),

        -- player_hong (User_ID=6) 通知
        (6, 'Session_Reminder', N'拼车成功',    N'你参团的《昆仑》已成功拼车！请于 14:00 前到达日式和风房',                 'Fact_Session_Schedule', '101',  0, '2026-06-02T13:00:00'),
        (6, 'Payment_Confirm',  N'支付确认',    N'你在《昆仑》场次的支付 ¥198.00 已确认',                                   'Payment_Transaction_Table','2',  0, '2026-06-02T09:50:00'),
        (6, 'Coupon_Issued',   N'优惠券到账',   N'「《昆仑》尝鲜9折券」已发放，有效期至 2026-06-14',                        'User_Coupon_Instance',  '4',    0, '2026-05-15T12:00:00'),
        (6, 'Review_Request',  N'评价邀请',    N'你参与的《昆仑》场次已结束，快来评价你的体验吧！',                          'Fact_Session_Schedule', '101',  0, '2026-06-02T19:30:00'),

        -- player_lily (User_ID=7) 通知
        (7, 'Payment_Confirm',  N'支付提醒',    N'你在《昆仑》场次的参团费用 ¥198.00 尚未支付，请及时完成支付',             'Bridge_Player_Registration','3',0,'2026-06-02T10:30:00'),
        (7, 'Session_Reminder', N'拼车成功',    N'你参团的《第七号嫌疑人》已锁车！请于 18:00 前到达',                       'Fact_Session_Schedule', '103',  0, '2026-06-02T14:30:00'),
        (7, 'Coupon_Issued',   N'新人专享',    N'「新人专享8折券」已到账！首单即享 8 折，有效期 30 天！',                   'User_Coupon_Instance',  '1',    0, '2026-05-20T09:00:00'),

        -- player_david (User_ID=8) 通知
        (8, 'Session_Reminder', N'拼车成功',    N'你参团的《第七号嫌疑人》已锁车！你选择了「嫌疑人A」角色',                'Fact_Session_Schedule', '103',  0, '2026-06-02T14:30:00'),
        (8, 'Payment_Confirm',  N'支付确认',    N'你在《第七号嫌疑人》场次的支付 ¥188.00 已确认',                           'Payment_Transaction_Table','8',  0, '2026-06-02T13:35:00'),
        (8, 'Coupon_Issued',   N'优惠券过期',  N'你的「满200减30」优惠券已过期，剩余 2 张优惠券可用',                       'User_Coupon_Instance',  '5',    0, '2026-06-01T08:00:00');
    `);

    console.log('\n========================================');
    console.log('  种子数据导入完成！');
    console.log('========================================\n');

    // 重新启用被禁用的触发器
    console.log('  重新启用触发器...');
    await pool.request().query(`ENABLE TRIGGER trg_Payment_SyncCachedStatus ON Payment_Transaction_Table`);
    console.log('  ✓ 触发器已启用\n');

    // 重新启用所有外键约束
    console.log('  重新启用外键约束...');
    for (const row of fkResult.recordset) {
      try {
        await pool.request().query(`ALTER TABLE ${row.Table_Name} WITH CHECK CHECK CONSTRAINT ${row.FK_Name}`);
      } catch (e) { /* 忽略 */ }
    }
    console.log(`  已启用 ${fkResult.recordset.length} 个外键约束\n`);

    // 验证
    const counts = {};
    for (const t of allTables) {
      try {
        const r = await pool.request().query('SELECT COUNT(*) AS cnt FROM ' + t);
        counts[t] = r.recordset[0].cnt;
      } catch (e) { counts[t] = 'ERR'; }
    }
    console.log('数据验证:');
    for (const [t, c] of Object.entries(counts)) {
      console.log(`  ${t}: ${c} rows`);
    }

  } catch (err) {
    console.error('种子数据导入失败:', err);
    process.exit(1);
  } finally {
    await pool.close();
  }
}

reseed();

-- =============================================
-- 权限写保护 + 初始种子数据
-- =============================================
USE STS_DAMS;
GO

-- =============================================
-- 2.11 权限与写保护
-- =============================================

-- 财务表 + 审计表：禁止任何修改
DENY UPDATE, DELETE ON Payment_Transaction_Table TO PUBLIC;
DENY UPDATE, DELETE ON Inventory_Movement_Ledger TO PUBLIC;
DENY UPDATE, DELETE ON Fact_Session_Consumption TO PUBLIC;
DENY UPDATE, DELETE ON System_Audit_Log_Table TO PUBLIC;
GO

PRINT 'Write-protection applied to financial/audit tables.';
GO

-- =============================================
-- 初始种子数据
-- =============================================

-- 账户数据
-- WARNING: 种子密码使用占位符 '123456'（SHA-256 + per-user salt 哈希）。
-- 生产部署后必须立即运行密码重置脚本:
--   cd sts-dams-backend && node scripts/reset-passwords.js --random
-- 此脚本会用 bcrypt(10轮) 替换所有哈希并生成安全随机密码。
-- 凭证输出到 .deployment-credentials.txt（已 gitignore），由部署者安全分发。
SET IDENTITY_INSERT Account_Base_Table ON;
GO
INSERT INTO Account_Base_Table (User_ID, Account_Name, Password_Hash, Contact_Phone, Role_Type, Account_Status)
VALUES
    (1, 'admin',   HASHBYTES('SHA2_256', CONCAT('admin', ':', '123456')), '+8613800000001', 3, 'Active'),
    (2, 'dm_ye',   HASHBYTES('SHA2_256', CONCAT('dm_ye', ':', '123456')), '+8613800000002', 2, 'Active'),
    (3, 'dm_chen', HASHBYTES('SHA2_256', CONCAT('dm_chen', ':', '123456')), '+8613800000003', 2, 'Active'),
    (4, 'dm_lin',  HASHBYTES('SHA2_256', CONCAT('dm_lin', ':', '123456')), '+8613800000004', 2, 'Active'),
    (5, 'player_xiaoming', HASHBYTES('SHA2_256', CONCAT('player_xiaoming', ':', '123456')), '+8613800000005', 1, 'Active'),
    (6, 'player_hong',     HASHBYTES('SHA2_256', CONCAT('player_hong', ':', '123456')), '+8613800000006', 1, 'Active'),
    (7, 'player_lily',     HASHBYTES('SHA2_256', CONCAT('player_lily', ':', '123456')), '+8613800000007', 1, 'Active'),
    (8, 'player_david',    HASHBYTES('SHA2_256', CONCAT('player_david', ':', '123456')), '+8613800000008', 1, 'Active');
GO
SET IDENTITY_INSERT Account_Base_Table OFF;
GO

-- DM 资质（底薪数据与前端 Mock 保持一致）
INSERT INTO DM_Profile_Table (DM_User_ID, DM_Stage_Name, Base_Per_Session_Wage, Employment_Status, Hire_Date)
VALUES
    (2, '夜雨',   150.00, 'Active',    '2025-06-01'),
    (3, '沉渊',   120.00, 'Active',    '2025-09-15'),
    (4, '林深',   180.00, 'Active',    '2026-03-01');
GO

-- 房间
SET IDENTITY_INSERT Dim_Store_Room ON;
GO
INSERT INTO Dim_Store_Room (Room_ID, Room_Name, Room_Max_Capacity, Room_Theme, Room_Operating_Status)
VALUES
    (1, '日式和风房',   8, '和风',    'Operational'),
    (2, '欧式古堡房',   8, '哥特',    'Operational'),
    (3, '民国老上海',   8, '民国',    'Operational'),
    (4, '现代办公房',   6, '现代办公', 'Operational'),
    (5, '恐怖密室房',   7, '恐怖',    'Under_Maintenance');
GO
SET IDENTITY_INSERT Dim_Store_Room OFF;
GO

-- 剧本
SET IDENTITY_INSERT Dim_Script_Dictionary ON;
GO
INSERT INTO Dim_Script_Dictionary (Script_ID, Script_Title, Min_Required_Players, Max_Allowed_Players, Estimated_Duration, Base_Price, Primary_Genre, Is_Retired)
VALUES
    (1, '昆仑',             4, 7, 300, 198.00, 6, 0),
    (2, '被嫌弃的松子的一生', 3, 6, 240, 168.00, 2, 0),
    (3, '第七号嫌疑人',      3, 5, 210, 188.00, 3, 0),
    (4, '来电',             4, 8, 240, 158.00, 4, 0),
    (5, '雪乡',             3, 6, 270, 178.00, 1, 0),
    (6, '漓川怪谈簿',        3, 7, 270, 188.00, 7, 0);
GO
SET IDENTITY_INSERT Dim_Script_Dictionary OFF;
GO

-- 剧本角色
INSERT INTO Script_Role_Definition_Table (Script_ID, Role_Name, Gender_Restriction, Role_Description)
VALUES
    (1, '李探长',    'Male',   '心思缜密的私家侦探'),
    (1, '夜半歌姬',  'Female', '神秘的歌女，知情甚多'),
    (1, '昆仑道人',  'Male',   '隐居昆仑山中的修道之人'),
    (1, '白芷',      'Female', '医术高超的女大夫'),
    (1, '铁剑客',    'Male',   '剑术独步天下的侠客'),
    (1, '紫烟',      'Female', '擅长易容术的江湖奇女子'),
    (1, '冷面将军',  'Any',    '戍守边关的威严将军'),
    (2, '松子',        'Female', '温柔而坚韧的女主角'),
    (2, '作家',        'Male',   '以松子故事为蓝本的落魄作家'),
    (2, '松子之妹',    'Female', '默默守护松子的妹妹'),
    (2, '初恋男友',    'Male',   '松子最初的恋人'),
    (3, '刑警队长',    'Male',   '负责调查案件的刑警队长'),
    (3, '法医',        'Female', '资深女法医'),
    (3, '嫌疑人A',     'Male',   '被指控的关键嫌疑人'),
    (3, '目击证人',    'Female', '案发当天目击证人'),
    (4, '主持人',      'Any', '来电节目的主持人'),
    (4, '玩家A',       'Any', '被选中的幸运玩家'),
    (4, '玩家B',       'Any', '被选中的幸运玩家'),
    (4, '玩家C',       'Any', '被选中的幸运玩家'),
    (4, '玩家D',       'Any', '被选中的幸运玩家'),
    (5, '民宿老板娘',  'Female', '雪乡民宿老板娘'),
    (5, '背包客',      'Male',   '独自旅行的背包客'),
    (5, '摄影师',      'Female', '热爱雪乡的摄影师'),
    (6, '巫女',        'Female', '掌管漓川神社的巫女'),
    (6, '阴阳师',      'Male',   '来自京都的阴阳师'),
    (6, '画师',        'Male',   '痴迷怪谈的画师'),
    (6, '茶屋侍女',    'Female', '隐藏的神秘侍女'),
    (6, '神官',        'Male',   '恪守教条的神官');
GO

-- 剧本副本
SET IDENTITY_INSERT Asset_Script_Copy_Table ON;
GO
INSERT INTO Asset_Script_Copy_Table (Copy_ID, Copy_Asset_Barcode, Script_ID, Authorization_Type, Asset_Condition, Purchase_Date, Current_Storage_Location)
VALUES
    (1, 'BARCODE-KL-001', 1, 'Boxed',          'Perfect', '2025-06-15', '前台储物柜 A-3'),
    (2, 'BARCODE-SZ-001', 2, 'Exclusive',      'Worn',    '2025-07-20', '前台储物柜 B-1'),
    (3, 'BARCODE-QH-001', 3, 'Boxed',          'Perfect', '2025-11-10', '前台储物柜 C-2'),
    (4, 'BARCODE-LD-001', 4, 'Boxed',          'Perfect', '2026-01-05', '前台储物柜 D-1'),
    (5, 'BARCODE-LJ-001', 6, 'One_Of_A_Kind',  'Perfect', '2025-10-01', '前台储物柜 E-1');
GO
SET IDENTITY_INSERT Asset_Script_Copy_Table OFF;
GO

-- DM 剧本能力
INSERT INTO DM_Script_Capability_Table (DM_User_ID, Script_ID, Proficiency_Level)
VALUES
    (2, 1, 'Expert'), (2, 2, 'Proficient'), (2, 6, 'Proficient'),
    (3, 3, 'Expert'), (3, 4, 'Proficient'),
    (4, 2, 'Trained'), (4, 4, 'Trained'), (4, 5, 'Trained'), (4, 6, 'Trained');
GO

-- DM 今日排班（动态日期：当天 12:00 ~ 次日 02:00）
INSERT INTO DM_Shift_Availability_Table (DM_User_ID, Available_Start, Available_End, Shift_Type)
VALUES
    (2, DATEADD(DAY, DATEDIFF(DAY, 0, GETDATE()), '12:00:00'), DATEADD(DAY, DATEDIFF(DAY, 0, GETDATE()) + 1, '02:00:00'), 'Regular'),
    (3, DATEADD(DAY, DATEDIFF(DAY, 0, GETDATE()), '18:00:00'), DATEADD(DAY, DATEDIFF(DAY, 0, GETDATE()) + 1, '01:00:00'), 'Regular'),
    (4, DATEADD(DAY, DATEDIFF(DAY, 0, GETDATE()), '14:00:00'), DATEADD(DAY, DATEDIFF(DAY, 0, GETDATE()) + 1, '00:00:00'), 'Regular');
GO

-- 商品库存（名称与前端 Mock 数据对齐）
SET IDENTITY_INSERT Dim_Inventory_Item ON;
GO
INSERT INTO Dim_Inventory_Item (Item_ID, Item_Name, Current_Stock_Cache, Cost_Unit_Price, Selling_Unit_Price, Item_Category, Safety_Alert_Threshold)
VALUES
    (1, '进口可乐',         120, 3.50,  10.00, '饮料',    20),
    (2, '进口雪碧',          80,  3.50,  10.00, '饮料',    15),
    (3, '矿泉水',            60,  1.00,   5.00, '饮料',    20),
    (4, '薯片（大包）',       40,  6.00,  15.00, '零食',    10),
    (5, '话梅',              30,  4.00,  10.00, '零食',     5),
    (6, '剧本配套信封耗材',     40,  2.00,   5.00, '剧本耗材', 15),
    (7, '一次性主题服饰内衬',  80,  1.50,   5.00, '道具服饰', 20);
GO
SET IDENTITY_INSERT Dim_Inventory_Item OFF;
GO

-- 初始库存建账流水（期初库存）
INSERT INTO Inventory_Movement_Ledger (Item_ID, Quantity_Delta, Movement_Type, Operator_User_ID, Movement_Reason)
SELECT Item_ID, Current_Stock_Cache, 'Initial_Stock', 1, '系统初始化-期初建账'
FROM Dim_Inventory_Item;
GO

-- 场次种子数据（演示用，2026-06-02 当天）
-- 注意：仅当 Fact_Session_Schedule 为空时才插入，避免重复执行报错
IF NOT EXISTS (SELECT 1 FROM Fact_Session_Schedule)
BEGIN
    SET IDENTITY_INSERT Fact_Session_Schedule ON;

    INSERT INTO Fact_Session_Schedule (Session_ID, Copy_ID, Room_ID, DM_User_ID,
        Scheduled_Start_Time, Scheduled_End_Time, Session_Status,
        Frozen_Per_Head_Price, Created_By_User_ID)
    VALUES
        (101, 1, 1, 2, '2026-06-02T14:00:00', '2026-06-02T19:00:00', 'Matching',      198.00, 1),
        (102, 2, 2, 4, '2026-06-02T14:00:00', '2026-06-02T18:00:00', 'Matching',      168.00, 1),
        (103, 3, 3, 3, '2026-06-02T18:00:00', '2026-06-02T22:30:00', 'In_Progress',  188.00, 1),
        (104, 4, 4, 4, '2026-06-02T19:00:00', '2026-06-02T23:00:00', 'Locked_Ready', 158.00, 1);

    SET IDENTITY_INSERT Fact_Session_Schedule OFF;

    -- 玩家参团登记
    -- Role_ID 参考种子角色数据：
    --   Script 1 (昆仑): Role 1-7    Script 2 (松子): Role 8-11
    --   Script 3 (嫌疑人): Role 12-15  Script 4 (来电): Role 16-20
    INSERT INTO Bridge_Player_Registration (Session_ID, Player_User_ID, Role_ID, Cached_Payment_Status)
    VALUES
        (101, 5, NULL, 'Deposit_Paid'),
        (101, 6, 6,    'Fully_Paid'),     -- 紫烟 (Script 1, Female)
        (101, 7, 1,    'Unpaid'),          -- 李探长 (Script 1, Male)
        (102, 5, 8,    'Fully_Paid'),      -- 松子 (Script 2, Female)
        (102, 8, NULL, 'Unpaid'),
        (103, 5, 13,   'Fully_Paid'),      -- 法医 (Script 3, Female)
        (103, 6, 15,   'Fully_Paid'),      -- 目击证人 (Script 3, Female)
        (103, 7, 14,   'Fully_Paid'),      -- 嫌疑人A (Script 3, Male)
        (103, 8, 12,   'Deposit_Paid'),    -- 刑警队长 (Script 3, Male)
        (104, 5, NULL, 'Fully_Paid'),
        (104, 6, NULL, 'Fully_Paid'),
        (104, 7, NULL, 'Deposit_Paid');
END;
GO

-- =============================================
-- 扩展模块种子数据（会员积分、优惠券、通知）
-- =============================================

-- 会员等级（仅当表为空）
IF NOT EXISTS (SELECT 1 FROM Dim_Member_Level)
BEGIN
    SET IDENTITY_INSERT Dim_Member_Level ON;
    INSERT INTO Dim_Member_Level (Level_ID, Level_Name, Min_Required_Points, Discount_Rate, Point_Earning_Multiplier)
    VALUES
        (1, 'Bronze',   0,     1.000, 1.00),
        (2, 'Silver',   500,   0.980, 1.05),
        (3, 'Gold',     2000,  0.950, 1.10),
        (4, 'Platinum', 5000,  0.920, 1.20),
        (5, 'Diamond',  12000, 0.880, 1.35);
    SET IDENTITY_INSERT Dim_Member_Level OFF;
END;
GO

-- 会员档案（仅当表为空）
IF NOT EXISTS (SELECT 1 FROM User_Member_Profile)
BEGIN
    INSERT INTO User_Member_Profile (User_ID, Accumulated_Points, Current_Level_ID, Total_Lifetime_Points, Level_Upgraded_At)
    VALUES
        (5, 2350, 3, 2850, '2026-06-02T08:00:00'),
        (6, 680,  2, 780,  '2026-06-02T09:00:00'),
        (7, 200,  1, 300,  NULL),
        (8, 5800, 4, 6200, '2026-06-02T10:00:00');
END;
GO

-- 积分流水（仅当表为空）
IF NOT EXISTS (SELECT 1 FROM Member_Points_Ledger)
BEGIN
    INSERT INTO Member_Points_Ledger (User_ID, Points_Delta, Transaction_Type, Related_Session_ID, Points_Balance_After, Operator_User_ID, Remarks, Created_At)
    VALUES
        (5, 100,  'Earn_Session',      101, 2350, 1, NULL,                 '2026-06-02T14:00:00'),
        (5, 50,   'Earn_Consumption',  103, 2250, 2, NULL,                 '2026-06-02T18:30:00'),
        (5, -500, 'Redeem_Cash',       NULL, 2200, 2, '积分兑换抵扣 ¥5.00', '2026-06-02T14:30:00'),
        (6, 100,  'Earn_Session',      103, 680,  1, NULL,                 '2026-06-02T13:00:00'),
        (6, 60,   'Earn_Consumption',  103, 580,  2, NULL,                 '2026-06-02T19:00:00'),
        (7, 100,  'Earn_Session',      101, 200,  1, NULL,                 '2026-06-02T14:00:00'),
        (8, 100,  'Earn_Session',      103, 5800, 1, NULL,                 '2026-06-02T13:00:00'),
        (8, -1000,'Redeem_Cash',       NULL, 5700, 2, '积分兑换抵扣 ¥10.00','2026-06-02T15:00:00');
END;
GO

-- 优惠券模板（仅当表为空）
IF NOT EXISTS (SELECT 1 FROM Coupon_Template)
BEGIN
    SET IDENTITY_INSERT Coupon_Template ON;
    INSERT INTO Coupon_Template (Template_ID, Coupon_Name, Discount_Type, Discount_Value, Min_Order_Amount, Max_Discount_Cap, Valid_Days_From_Issue, Applicable_Script_ID, Total_Issuance_Limit, Per_User_Limit, Is_Active, Created_By_User_ID, Created_At)
    VALUES
        (1, '新人专享8折券',       'Percent_Off',  0.20, 0,   30.00, 30, NULL, 100, 1, 1, 1, '2026-01-01T00:00:00'),
        (2, '满200减30',           'Fixed_Amount', 30.00, 200, NULL,  60, NULL, NULL,3, 1, 1, '2026-02-01T00:00:00'),
        (3, '《昆仑》尝鲜9折券',   'Percent_Off',  0.10, 0,   20.00, 15, 1,    50,  1, 1, 1, '2026-03-01T00:00:00');
    SET IDENTITY_INSERT Coupon_Template OFF;
END;
GO

-- 优惠券实例（仅当表为空）
IF NOT EXISTS (SELECT 1 FROM User_Coupon_Instance)
BEGIN
    SET IDENTITY_INSERT User_Coupon_Instance ON;
    INSERT INTO User_Coupon_Instance (Coupon_ID, Template_ID, User_ID, Coupon_Status, Issued_At, Expires_At, Used_At, Issued_By_User_ID)
    VALUES
        (1, 1, 7, 'Unused',  '2026-05-20T00:00:00', '2026-06-19T23:59:59', NULL,                     1),
        (2, 1, 8, 'Used',    '2026-05-10T00:00:00', '2026-06-09T23:59:59', '2026-05-25T00:00:00',     1),
        (3, 2, 5, 'Unused',  '2026-05-01T00:00:00', '2026-06-30T23:59:59', NULL,                     1),
        (4, 3, 6, 'Unused',  '2026-05-15T00:00:00', '2026-05-25T23:59:59', NULL,                     1),
        (5, 2, 8, 'Expired', '2026-04-01T00:00:00', '2026-05-01T23:59:59', NULL,                     1);
    SET IDENTITY_INSERT User_Coupon_Instance OFF;
END;
GO

-- 评价数据（仅当表为空）
IF NOT EXISTS (SELECT 1 FROM Fact_Session_Review)
BEGIN
    SET IDENTITY_INSERT Fact_Session_Review ON;
    INSERT INTO Fact_Session_Review (Review_ID, Session_ID, Reviewer_User_ID, Registration_ID, DM_Rating, Script_Rating, Room_Rating, Overall_Rating, Review_Comment, Tags, Is_Anonymous, Created_At)
    VALUES
        (1, 101, 5, 1, 5, 4, 4, 4, '夜雨DM带场非常专业，沉浸感很强！',             'DM入戏深,氛围感强',                             0, '2026-06-02T19:30:00'),
        (2, 101, 6, 2, 4, 5, 4, 5, '昆仑剧本太精彩了，推理层层递进！',               '推理烧脑,DM入戏深',                             0, '2026-06-02T19:45:00'),
        (3, 102, 5, 4, 5, 5, 3, 4, '松子的故事太催泪了，哭到停不下来',               '情感催泪',                                       1, '2026-06-02T18:15:00'),
        (4, 103, 5, 6, 5, 5, 4, 5, '沉渊DM演技炸裂，案件设计巧妙，强烈推荐！',       '推理烧脑,DM入戏深,氛围感强',                    0, '2026-06-02T22:45:00'),
        (5, 103, 6, 7, 4, 4, 5, 4, '房间布置很有民国氛围，体验很棒',                 '氛围感强',                                       0, '2026-06-02T23:00:00'),
        (6, 103, 8, 9, 5, 5, 5, 5, '年度最佳剧本杀体验！各方面都完美',               '推理烧脑,DM入戏深,氛围感强',                    0, '2026-06-02T23:15:00');
    SET IDENTITY_INSERT Fact_Session_Review OFF;
END;
GO

-- 通知数据（仅当表为空）
IF NOT EXISTS (SELECT 1 FROM User_Notification)
BEGIN
    INSERT INTO User_Notification (Recipient_User_ID, Notification_Type, Title, Content, Related_Entity_Type, Related_Entity_ID, Is_Read, Created_At)
    VALUES
        (5, 'Session_Reminder', '新场次发布',    '今晚 19:00 《来电》现代办公房 正在拼车中！',            'Fact_Session_Schedule', '104', 0, '2026-06-02T07:00:00'),
        (5, 'Session_Reminder', '拼车成功',      '你参团的《第七号嫌疑人》已锁车，请按时到场',             'Fact_Session_Schedule', '103', 0, '2026-06-02T14:30:00'),
        (7, 'Payment_Confirm',  '支付提醒',      '你在《昆仑》场次的参团费用尚未支付，请及时完成支付',     'Bridge_Player_Registration', '3', 0, '2026-06-02T10:30:00'),
        (1, 'Low_Stock_Alert',  '库存预警',      '商品"话梅"当前库存仅剩 3 件，低于安全预警红线',          'Dim_Inventory_Item', '5', 1, '2026-06-02T18:00:00'),
        (1, 'Session_Reminder', '流局风险',      '《被嫌弃的松子的一生》开场前 2 小时仍不满足最低人数 3 人','Fact_Session_Schedule', '102', 1, '2026-06-02T14:00:00');
END;
GO

PRINT 'Expansion seed data inserted successfully.';
GO

PRINT 'Seed data inserted successfully.';
GO

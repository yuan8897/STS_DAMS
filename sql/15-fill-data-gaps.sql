-- =============================================
-- ⚠️ 已废弃 / DEPRECATED — 请使用 15b-fix-gaps.sql
-- =============================================
-- 原因: 本脚本引用了 Daily_KPI_Snapshot 表中不存在的列
--       (Total_Revenue, Total_Players, Avg_Session_Revenue)，
--       运行时将报错。15b-fix-gaps.sql 已修复此问题。
-- 保留此文件仅供历史参考，不应再执行。
-- =============================================
-- STS-DAMS 数据缺口填充脚本 (DEPRECATED)
-- 2026-06-04 | 补齐缺失数据，覆盖全业务场景
-- 幂等保护：所有 INSERT 使用 IF NOT EXISTS 检查
-- =============================================
USE STS_DAMS;
GO

SET QUOTED_IDENTIFIER ON;
GO

PRINT '============================================';
PRINT '  STS-DAMS 数据缺口填充开始';
PRINT '============================================';
GO

-- =============================================
-- 第一部分：执行图片字段扩展（若尚未执行）
-- =============================================

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('Dim_Script_Dictionary')
      AND name = 'Cover_Image_URL'
)
BEGIN
    ALTER TABLE Dim_Script_Dictionary
    ADD Cover_Image_URL NVARCHAR(500) NULL;
    PRINT '  ✓ Dim_Script_Dictionary.Cover_Image_URL 已添加';
END
ELSE
    PRINT '  → Dim_Script_Dictionary.Cover_Image_URL 已存在，跳过';
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('DM_Profile_Table')
      AND name = 'Avatar_Image_URL'
)
BEGIN
    ALTER TABLE DM_Profile_Table
    ADD Avatar_Image_URL NVARCHAR(500) NULL;
    PRINT '  ✓ DM_Profile_Table.Avatar_Image_URL 已添加';
END
ELSE
    PRINT '  → DM_Profile_Table.Avatar_Image_URL 已存在，跳过';
GO

-- =============================================
-- 第二部分：补齐缺失角色/账户数据
-- =============================================

-- C1: Store_Manager 种子账户
-- WARNING: 种子密码使用占位符 '123456'。
-- 生产部署后必须运行: cd sts-dams-backend && node scripts/reset-passwords.js --random
IF NOT EXISTS (SELECT 1 FROM Account_Base_Table WHERE Account_Name = 'store_mgr')
BEGIN
    SET IDENTITY_INSERT Account_Base_Table ON;
    INSERT INTO Account_Base_Table (User_ID, Account_Name, Password_Hash, Contact_Phone, Role_Type, Account_Status)
    VALUES (9, 'store_mgr', HASHBYTES('SHA2_256', CONCAT('store_mgr', ':', '123456')), '+8613800000009', 4, 'Active');
    SET IDENTITY_INSERT Account_Base_Table OFF;
    PRINT '  ✓ Store_Manager 账户 store_mgr 已创建 (User_ID=9, pwd=123456)';
END
ELSE
    PRINT '  → Store_Manager 账户已存在，跳过';
GO

-- C2: 补充 DM 档案图片 URL
UPDATE DM_Profile_Table SET Avatar_Image_URL = '/api/upload/file/dm_ye_avatar.png'  WHERE DM_User_ID = 2 AND Avatar_Image_URL IS NULL;
UPDATE DM_Profile_Table SET Avatar_Image_URL = '/api/upload/file/dm_chen_avatar.png' WHERE DM_User_ID = 3 AND Avatar_Image_URL IS NULL;
UPDATE DM_Profile_Table SET Avatar_Image_URL = '/api/upload/file/dm_lin_avatar.png'  WHERE DM_User_ID = 4 AND Avatar_Image_URL IS NULL;
PRINT '  ✓ DM 头像 URL 已更新（若为空）';
GO

-- C3: 补充剧本封面图片 URL
UPDATE Dim_Script_Dictionary SET Cover_Image_URL = '/api/upload/file/cover_kunlun.jpg'   WHERE Script_ID = 1 AND Cover_Image_URL IS NULL;
UPDATE Dim_Script_Dictionary SET Cover_Image_URL = '/api/upload/file/cover_matsuko.jpg'   WHERE Script_ID = 2 AND Cover_Image_URL IS NULL;
UPDATE Dim_Script_Dictionary SET Cover_Image_URL = '/api/upload/file/cover_suspect7.jpg'  WHERE Script_ID = 3 AND Cover_Image_URL IS NULL;
UPDATE Dim_Script_Dictionary SET Cover_Image_URL = '/api/upload/file/cover_call.jpg'      WHERE Script_ID = 4 AND Cover_Image_URL IS NULL;
UPDATE Dim_Script_Dictionary SET Cover_Image_URL = '/api/upload/file/cover_snow.jpg'      WHERE Script_ID = 5 AND Cover_Image_URL IS NULL;
UPDATE Dim_Script_Dictionary SET Cover_Image_URL = '/api/upload/file/cover_lichuan.jpg'   WHERE Script_ID = 6 AND Cover_Image_URL IS NULL;
PRINT '  ✓ 剧本封面 URL 已更新（若为空）';
GO

-- =============================================
-- 第三部分：补齐折扣使用记录 (Discount_Usage_Log)
-- =============================================

IF NOT EXISTS (SELECT 1 FROM Discount_Usage_Log)
BEGIN
    -- 对应 Coupon_ID=2 (Used, 新人8折): 假设使用于 Payment 2 (¥198 尾款, 折扣 = 198×0.2=39.6, 封顶30)
    INSERT INTO Discount_Usage_Log (Coupon_ID, Transaction_ID, Discount_Amount)
    VALUES
        (1, 2, 2, 30.00);
    PRINT '  ✓ Discount_Usage_Log 已填充 (1 条记录)';
END
ELSE
    PRINT '  → Discount_Usage_Log 已有数据，跳过';
GO

-- =============================================
-- 第四部分：补齐审计日志 (System_Audit_Log_Table)
-- =============================================

IF NOT EXISTS (SELECT 1 FROM System_Audit_Log_Table)
BEGIN
    INSERT INTO System_Audit_Log_Table (Store_ID, Operator_User_ID, Action_Type, Target_Entity, Target_Record_ID, Action_Details, Logged_At)
    VALUES
        (1, 1, 'CREATE_SESSION',   'Fact_Session_Schedule', '101', N'{"status":"Matching","script":"昆仑","room":"日式和风房","dm":"夜雨"}',                 '2026-06-02T08:00:00'),
        (1, 1, 'CREATE_SESSION',   'Fact_Session_Schedule', '102', N'{"status":"Matching","script":"被嫌弃的松子的一生","room":"欧式古堡房","dm":"林深"}',       '2026-06-02T08:30:00'),
        (1, 1, 'CREATE_SESSION',   'Fact_Session_Schedule', '103', N'{"status":"Matching","script":"第七号嫌疑人","room":"民国老上海","dm":"沉渊"}',             '2026-06-02T09:00:00'),
        (1, 1, 'CREATE_SESSION',   'Fact_Session_Schedule', '104', N'{"status":"Matching","script":"来电","room":"现代办公房","dm":"林深"}',                   '2026-06-02T09:30:00'),
        (1, 2, 'UPDATE_SESSION',   'Fact_Session_Schedule', '101', N'{"old_status":"Matching","new_status":"Locked_Ready"}',                                '2026-06-02T12:00:00'),
        (1, 3, 'UPDATE_SESSION',   'Fact_Session_Schedule', '103', N'{"old_status":"Matching","new_status":"Locked_Ready"}',                                '2026-06-02T17:00:00'),
        (1, 4, 'UPDATE_SESSION',   'Fact_Session_Schedule', '104', N'{"old_status":"Matching","new_status":"Locked_Ready"}',                                '2026-06-02T17:30:00'),
        (1, 2, 'UPDATE_SESSION',   'Fact_Session_Schedule', '101', N'{"old_status":"Locked_Ready","new_status":"In_Progress"}',                             '2026-06-02T14:00:00'),
        (1, 3, 'UPDATE_SESSION',   'Fact_Session_Schedule', '103', N'{"old_status":"Locked_Ready","new_status":"In_Progress"}',                             '2026-06-02T18:00:00'),
        (1, 4, 'UPDATE_SESSION',   'Fact_Session_Schedule', '102', N'{"old_status":"Matching","new_status":"In_Progress"}',                                 '2026-06-02T14:00:00'),
        (1, 2, 'UPDATE_SESSION',   'Fact_Session_Schedule', '101', N'{"old_status":"In_Progress","new_status":"Completed"}',                                '2026-06-02T19:00:00'),
        (1, 4, 'UPDATE_SESSION',   'Fact_Session_Schedule', '102', N'{"old_status":"In_Progress","new_status":"Completed"}',                                '2026-06-02T18:00:00'),
        (1, 3, 'UPDATE_SESSION',   'Fact_Session_Schedule', '103', N'{"old_status":"In_Progress","new_status":"Completed"}',                                '2026-06-02T22:30:00'),
        (1, 1, 'CREATE_SESSION',   'Fact_Session_Schedule', '105', N'{"status":"Matching","script":"昆仑","room":"日式和风房","dm":"夜雨"}',                 '2026-06-03T08:00:00'),
        (1, 1, 'CREATE_SESSION',   'Fact_Session_Schedule', '106', N'{"status":"Matching","script":"漓川怪谈簿","room":"恐怖密室房","dm":"沉渊"}',           '2026-06-03T08:30:00'),
        (1, 1, 'CREATE_SESSION',   'Fact_Session_Schedule', '107', N'{"status":"Matching","script":"被嫌弃的松子的一生","room":"欧式古堡房","dm":"林深"}',     '2026-06-03T09:00:00'),
        (1, 1, 'CREATE_SESSION',   'Fact_Session_Schedule', '108', N'{"status":"Matching","script":"漓川怪谈簿","room":"现代办公房","dm":"夜雨"}',           '2026-06-03T09:30:00'),
        (1, 4, 'MODIFY_DM_SHIFT',  'DM_Shift_Availability_Table', '95',  N'{"dm":"夜雨","date":"2026-06-03","action":"添加排班"}',                        '2026-06-02T20:00:00'),
        (1, 1, 'ADJUST_INVENTORY', 'Dim_Inventory_Item', '5', N'{"item":"话梅","old_stock":30,"new_stock":15,"reason":"盘点调整"}',                        '2026-06-03T10:00:00'),
        (1, 1, 'ISSUE_REFUND',     'Payment_Transaction_Table', '1', N'{"amount":100,"reason":"玩家取消参团退款"}',                                       '2026-06-03T11:00:00'),
        (1, 2, 'UPDATE_SESSION',   'Fact_Session_Schedule', '108', N'{"old_status":"Matching","new_status":"In_Progress"}',                                '2026-06-03T19:00:00');
    PRINT '  ✓ System_Audit_Log_Table 已填充 (21 条记录)';
END
ELSE
    PRINT '  → System_Audit_Log_Table 已有数据，跳过';
GO

-- =============================================
-- 第五部分：补充支付交易 — 新增类型场景
-- =============================================

-- E2: 退款交易 (Refund)
IF NOT EXISTS (SELECT 1 FROM Payment_Transaction_Table WHERE Transaction_Type = 'Refund')
BEGIN
    INSERT INTO Payment_Transaction_Table (Registration_ID, Transaction_Type, Amount, Payment_Method, Operator_User_ID, Remarks, Processed_At)
    VALUES
        (1, 1, 'Refund', -100.00, 'WeChat', 1, N'玩家取消参团-退还订金', '2026-06-02T11:00:00');
    PRINT '  ✓ Refund 支付记录已添加';
END
ELSE
    PRINT '  → Refund 记录已存在，跳过';
GO

-- E3: 调整交易 (Adjustment)
IF NOT EXISTS (SELECT 1 FROM Payment_Transaction_Table WHERE Transaction_Type = 'Adjustment')
BEGIN
    INSERT INTO Payment_Transaction_Table (Registration_ID, Transaction_Type, Amount, Payment_Method, Operator_User_ID, Remarks, Processed_At)
    VALUES
        (1, 5, 'Adjustment', 20.00, 'Cash', 1, N'DM绩效奖励调整', '2026-06-02T18:00:00');
    PRINT '  ✓ Adjustment 支付记录已添加';
END
ELSE
    PRINT '  → Adjustment 记录已存在，跳过';
GO

-- E4: 会员余额支付
IF NOT EXISTS (SELECT 1 FROM Payment_Transaction_Table WHERE Payment_Method = 'Member_Balance')
BEGIN
    INSERT INTO Payment_Transaction_Table (Registration_ID, Transaction_Type, Amount, Payment_Method, Operator_User_ID, Remarks, Processed_At)
    VALUES
        (1, 7, 'Final_Payment', 88.00, 'Member_Balance', 3, N'使用会员积分抵扣后余额支付', '2026-06-03T15:00:00');
    PRINT '  ✓ Member_Balance 支付记录已添加';
END
ELSE
    PRINT '  → Member_Balance 记录已存在，跳过';
GO

-- =============================================
-- 第六部分：补充场次消费记录 (Fact_Session_Consumption)
-- 为 Session 108 (In_Progress) 添加消费数据
-- =============================================

IF NOT EXISTS (SELECT 1 FROM Fact_Session_Consumption WHERE Session_ID = 108)
BEGIN
    INSERT INTO Fact_Session_Consumption (Session_ID, Item_ID, Consumed_Quantity, Unit_Price_At_Sale, Line_Total_Cost, Recording_DM_User_ID)
    VALUES
        (108, 1, 2, 10.00, 20.00, 2),   -- 进口可乐 ×2
        (108, 4, 1, 15.00, 15.00, 2),   -- 薯片 ×1
        (108, 5, 1, 10.00, 10.00, 2);   -- 话梅 ×1
    PRINT '  ✓ Session 108 消费记录已添加 (3 条)';
END
ELSE
    PRINT '  → Session 108 消费记录已存在，跳过';
GO

-- 为 Session 104 添加消费记录
IF NOT EXISTS (SELECT 1 FROM Fact_Session_Consumption WHERE Session_ID = 104)
BEGIN
    INSERT INTO Fact_Session_Consumption (Session_ID, Item_ID, Consumed_Quantity, Unit_Price_At_Sale, Line_Total_Cost, Recording_DM_User_ID)
    VALUES
        (104, 2, 2, 10.00, 20.00, 4),   -- 进口雪碧 ×2
        (104, 6, 1, 5.00,  5.00,  4);    -- 信封耗材 ×1
    PRINT '  ✓ Session 104 消费记录已添加 (2 条)';
END
ELSE
    PRINT '  → Session 104 消费记录已存在，跳过';
GO

-- =============================================
-- 第七部分：补充库存流水 — 采购入库/报损/盘点
-- =============================================

-- B3: 采购入库
IF NOT EXISTS (SELECT 1 FROM Inventory_Movement_Ledger WHERE Movement_Type = 'Purchase_In')
BEGIN
    INSERT INTO Inventory_Movement_Ledger (Item_ID, Quantity_Delta, Movement_Type, Operator_User_ID, Movement_Reason, Movement_At)
    VALUES
        (1, 1, 50,  'Purchase_In', 1, N'常规补货-进口可乐',  '2026-06-03T10:00:00'),
        (1, 4, 30,  'Purchase_In', 1, N'常规补货-薯片',      '2026-06-03T10:30:00'),
        (1, 5, 20,  'Purchase_In', 1, N'紧急补货-话梅',      '2026-06-03T11:00:00');
    PRINT '  ✓ Purchase_In 库存流水已添加 (3 条)';
END
ELSE
    PRINT '  → Purchase_In 记录已存在，跳过';
GO

-- B3: 报损
IF NOT EXISTS (SELECT 1 FROM Inventory_Movement_Ledger WHERE Movement_Type = 'Damage_Loss')
BEGIN
    INSERT INTO Inventory_Movement_Ledger (Item_ID, Quantity_Delta, Movement_Type, Operator_User_ID, Movement_Reason, Movement_At)
    VALUES
        (1, 6, -3, 'Damage_Loss', 2, N'剧本信封耗材受潮损坏', '2026-06-03T14:00:00');
    PRINT '  ✓ Damage_Loss 库存流水已添加 (1 条)';
END
ELSE
    PRINT '  → Damage_Loss 记录已存在，跳过';
GO

-- B3: 盘点调整
IF NOT EXISTS (SELECT 1 FROM Inventory_Movement_Ledger WHERE Movement_Type = 'Inventory_Adjust')
BEGIN
    INSERT INTO Inventory_Movement_Ledger (Item_ID, Quantity_Delta, Movement_Type, Operator_User_ID, Movement_Reason, Movement_At)
    VALUES
        (1, 7, -5, 'Inventory_Adjust', 1, N'月末盘点-一次性服饰内衬差异调整', '2026-06-04T09:00:00');
    PRINT '  ✓ Inventory_Adjust 库存流水已添加 (1 条)';
END
ELSE
    PRINT '  → Inventory_Adjust 记录已存在，跳过';
GO

-- =============================================
-- 第八部分：补充优惠券实例 — 覆盖更多场景
-- =============================================

-- 为 store_mgr 用户发放优惠券
IF NOT EXISTS (SELECT 1 FROM User_Coupon_Instance WHERE User_ID = 9)
BEGIN
    SET IDENTITY_INSERT User_Coupon_Instance ON;
    INSERT INTO User_Coupon_Instance (Coupon_ID, Template_ID, User_ID, Coupon_Status, Issued_At, Expires_At, Issued_By_User_ID)
    VALUES
        (1, 6, 2, 5, 'Unused', '2026-06-04T00:00:00', '2026-08-03T23:59:59', 1),   -- xiaoming: 满200减30
        (1, 7, 3, 7, 'Unused', '2026-06-04T00:00:00', '2026-06-19T23:59:59', 1),   -- lily: 昆仑9折
        (1, 8, 1, 8, 'Unused', '2026-06-04T00:00:00', '2026-07-04T23:59:59', 1);   -- david: 新人8折
    SET IDENTITY_INSERT User_Coupon_Instance OFF;
    PRINT '  ✓ 新增优惠券实例已添加 (3 条)';
END
ELSE
    PRINT '  → User 9 优惠券已存在，跳过';
GO

-- =============================================
-- 第九部分：补充积分流水 — 覆盖全部 7 种类型
-- =============================================

-- E5/E6: Earn_Manual / Redeem_Gift / Expire / Adjust
IF NOT EXISTS (SELECT 1 FROM Member_Points_Ledger WHERE Transaction_Type = 'Earn_Manual')
BEGIN
    INSERT INTO Member_Points_Ledger (User_ID, Points_Delta, Transaction_Type, Points_Balance_After, Operator_User_ID, Remarks, Created_At)
    VALUES
        (1, 6, 200,  'Earn_Manual', 889,  1, N'店庆活动奖励积分',    '2026-06-04T00:00:00'),
        (1, 7, 50,   'Earn_Manual', 250,  1, N'完成新手任务奖励',    '2026-06-04T00:30:00'),
        (1, 8, -200, 'Redeem_Gift', 5600, 1, N'积分兑换周边礼品',    '2026-06-04T01:00:00'),
        (1, 5, -30,  'Adjust',      2320, 1, N'系统积分纠错调整',    '2026-06-04T01:30:00');
    PRINT '  ✓ 补充积分流水已添加 (4 条: Earn_Manual×2, Redeem_Gift, Adjust)';
END
ELSE
    PRINT '  → Earn_Manual 记录已存在，跳过';
GO

-- =============================================
-- 第十部分：补齐每日 KPI 快照 — 多日历史
-- =============================================

IF NOT EXISTS (SELECT 1 FROM Daily_KPI_Snapshot WHERE Snapshot_Date = '2026-06-01')
BEGIN
    INSERT INTO Daily_KPI_Snapshot (Store_ID, Snapshot_Date, Total_Revenue, Total_Sessions, Total_Players, Avg_Session_Revenue)
    VALUES
        (1, 1, '2026-06-01', 1560.00, 3, 10, 520.00);
    PRINT '  ✓ KPI 快照 06-01 已添加';
END
GO

IF NOT EXISTS (SELECT 1 FROM Daily_KPI_Snapshot WHERE Snapshot_Date = '2026-06-02')
BEGIN
    INSERT INTO Daily_KPI_Snapshot (Store_ID, Snapshot_Date, Total_Revenue, Total_Sessions, Total_Players, Avg_Session_Revenue)
    VALUES
        (1, 1, '2026-06-02', 2100.00, 4, 14, 525.00);
    PRINT '  ✓ KPI 快照 06-02 已添加';
END
GO

IF NOT EXISTS (SELECT 1 FROM Daily_KPI_Snapshot WHERE Snapshot_Date = '2026-06-03')
BEGIN
    -- 06-03 already has an auto-generated entry; only insert if date missing
    UPDATE Daily_KPI_Snapshot
    SET Total_Revenue = 1850.00, Total_Sessions = 4, Total_Players = 12, Avg_Session_Revenue = 462.50
    WHERE Snapshot_Date = '2026-06-03' AND Total_Revenue IS NULL;
    PRINT '  ✓ KPI 快照 06-03 数据已确认';
END
GO

-- =============================================
-- 第十一部分：补齐 DM 排班 — 确保覆盖到 06-04
-- =============================================

IF NOT EXISTS (SELECT 1 FROM DM_Shift_Availability_Table WHERE Available_Start >= '2026-06-05' AND Available_Start < '2026-06-06')
BEGIN
    INSERT INTO DM_Shift_Availability_Table (DM_User_ID, Available_Start, Available_End, Shift_Type)
    VALUES
        (1, 2, '2026-06-05T12:00:00', '2026-06-06T02:00:00', 'Regular'),
        (1, 3, '2026-06-05T14:00:00', '2026-06-06T01:00:00', 'Regular'),
        (1, 4, '2026-06-05T14:00:00', '2026-06-06T00:00:00', 'Regular');
    PRINT '  ✓ DM 06-05 排班已添加 (3 条)';
END
ELSE
    PRINT '  → 06-05 排班已存在，跳过';
GO

-- =============================================
-- 第十二部分：补充通知 — 覆盖全部 7 种类型
-- =============================================

-- E8: 补充缺失的通知类型 (Coupon_Expiring / Review_Request / System_Announce 等)
IF NOT EXISTS (SELECT 1 FROM User_Notification WHERE Notification_Type = 'Coupon_Expiring')
BEGIN
    INSERT INTO User_Notification (Recipient_User_ID, Notification_Type, Title, Content, Related_Entity_Type, Related_Entity_ID, Is_Read, Created_At)
    VALUES
        -- 优惠券临期提醒
        (1, 6, 'Coupon_Expiring', N'优惠券即将过期', N'你的《昆仑》尝鲜9折券将在1天后过期，请尽快使用！', 'User_Coupon_Instance', '4', 0, '2026-06-03T08:00:00'),
        -- 邀评通知
        (1, 8, 'Review_Request', N'邀评提醒', N'你参加的《第七号嫌疑人》已完成，快来评价吧！', 'Fact_Session_Schedule', '103', 0, '2026-06-03T10:00:00'),
        (1, 7, 'Review_Request', N'邀评提醒', N'你参加的《昆仑》已完成，快来评价吧！', 'Fact_Session_Schedule', '101', 1, '2026-06-02T19:05:00'),
        -- 系统公告
        (1, 5, 'System_Announce', N'系统升级通知', N'STS-DAMS 系统将于今晚 02:00-03:00 进行维护升级', NULL, NULL, 0, '2026-06-04T08:00:00'),
        (1, 6, 'System_Announce', N'系统升级通知', N'STS-DAMS 系统将于今晚 02:00-03:00 进行维护升级', NULL, NULL, 0, '2026-06-04T08:00:00'),
        (1, 7, 'System_Announce', N'系统升级通知', N'STS-DAMS 系统将于今晚 02:00-03:00 进行维护升级', NULL, NULL, 0, '2026-06-04T08:00:00'),
        -- 支付确认
        (1, 5, 'Payment_Confirm',  N'支付到账通知', N'你在《被嫌弃的松子的一生》场次的支付已到账 ¥168.00', 'Payment_Transaction_Table', '3', 1, '2026-06-02T10:35:00'),
        -- 库存预警 (新)
        (1, 1, 'Low_Stock_Alert',  N'库存预警', N'商品"一次性主题服饰内衬"当前库存仅剩75件，低于安全线', 'Dim_Inventory_Item', '7', 0, '2026-06-04T10:00:00');
    PRINT '  ✓ 补充通知已添加 (8 条: Coupon_Expiring×1, Review_Request×2, System_Announce×3, Payment_Confirm×1, Low_Stock_Alert×1)';
END
ELSE
    PRINT '  → Coupon_Expiring 通知已存在，跳过';
GO

-- =============================================
-- 第十三部分：新增场次数据 — 06-04 (今日)
-- =============================================

-- D1: 添加今日场次，覆盖全部 5 种状态
IF NOT EXISTS (SELECT 1 FROM Fact_Session_Schedule WHERE Scheduled_Start_Time >= '2026-06-04' AND Scheduled_Start_Time < '2026-06-05')
BEGIN
    SET IDENTITY_INSERT Fact_Session_Schedule ON;
    INSERT INTO Fact_Session_Schedule (Session_ID, Copy_ID, Room_ID, DM_User_ID, Scheduled_Start_Time, Scheduled_End_Time, Session_Status, Frozen_Per_Head_Price, Created_By_User_ID)
    VALUES
        (109, 1, 1, 2, '2026-06-04T14:00:00', '2026-06-04T19:00:00', 'Matching',      198.00, 1),
        (110, 3, 3, 3, '2026-06-04T15:00:00', '2026-06-04T18:30:00', 'Locked_Ready', 188.00, 1),
        (111, 5, 5, 4, '2026-06-04T14:00:00', '2026-06-04T18:30:00', 'Matching',      188.00, 1),
        -- E1: Aborted 状态的场次
        (112, 2, 2, 4, '2026-06-04T10:00:00', '2026-06-04T14:00:00', 'Aborted',       168.00, 1);
    SET IDENTITY_INSERT Fact_Session_Schedule OFF;

    -- 参团登记 (109-112)
    INSERT INTO Bridge_Player_Registration (Session_ID, Player_User_ID, Role_ID, Cached_Payment_Status)
    VALUES
        (109, 5, NULL, 'Deposit_Paid'),
        (109, 7, 2,    'Unpaid'),
        (110, 5, 12,   'Fully_Paid'),
        (110, 6, 14,   'Fully_Paid'),
        (110, 8, 15,   'Fully_Paid'),
        (111, 6, 21,   'Fully_Paid'),
        (111, 7, NULL, 'Deposit_Paid'),
        -- Aborted 场次的参团记录
        (112, 5, 9,    'Fully_Paid'),
        (112, 8, 10,   'Unpaid');

    PRINT '  ✓ 06-04 场次已添加 (4 场: 2 Matching, 1 Locked_Ready, 1 Aborted + 9 参团)';
END
ELSE
    PRINT '  → 06-04 场次已存在，跳过';
GO

-- =============================================
-- 第十四部分：补充评价数据 — 覆盖更多场景
-- =============================================

-- 为已完成场次补充来自不同玩家的评价（含低分场景）
IF NOT EXISTS (SELECT 1 FROM Fact_Session_Review WHERE Review_ID = 7)
BEGIN
    SET IDENTITY_INSERT Fact_Session_Review ON;
    INSERT INTO Fact_Session_Review (Review_ID, Session_ID, Reviewer_User_ID, Registration_ID, DM_Rating, Script_Rating, Room_Rating, Overall_Rating, Review_Comment, Tags, Is_Anonymous, Created_At)
    VALUES
        (1, 7,  102, 8, 5,  3, 4, 3, 3, N'松子剧本不错，但DM林深节奏有点快，欧式古堡房有点冷', '情感催泪', 0, '2026-06-02T18:30:00'),
        -- 低分评价 (用于测试低分高亮)
        (1, 8,  103, 7, 8,  2, 3, 3, 2, N'民国房间装修不错，但DM沉渊本场状态不佳，推理环节缩水严重', '氛围感强', 0, '2026-06-02T23:30:00'),
        -- 匿名差评
        (1, 9,  101, 7, 3,  4, 5, 5, 5, N'超喜欢昆仑剧本！夜雨DM讲解很细致', '推理烧脑,DM入戏深', 0, '2026-06-02T20:00:00'),
        -- 为 105-108 补充评价 (假设完成)
        (10, 105, 5, 13, 5, 4, 4, 5, N'夜雨DM一如既往的专业，昆仑百玩不厌', '推理烧脑,DM入戏深,氛围感强', 0, '2026-06-03T19:30:00');
    SET IDENTITY_INSERT Fact_Session_Review OFF;
    PRINT '  ✓ 补充评价已添加 (4 条，含低分和匿名场景)';
END
ELSE
    PRINT '  → Review 7 已存在，跳过';
GO

-- =============================================
-- 第十五部分：为 store_mgr 创建会员档案
-- =============================================

IF NOT EXISTS (SELECT 1 FROM User_Member_Profile WHERE User_ID = 9)
BEGIN
    INSERT INTO User_Member_Profile (User_ID, Accumulated_Points, Current_Level_ID, Total_Lifetime_Points)
    VALUES (9, 300, 1, 300);
    PRINT '  ✓ Store_Manager 会员档案已创建';
END
ELSE
    PRINT '  → Store_Manager 会员档案已存在，跳过';
GO

-- =============================================
-- 收尾：打印统计
-- =============================================

PRINT '============================================';
PRINT '  数据缺口填充完成!';
PRINT '============================================';
PRINT '  新增/更新数据统计:';
PRINT '    - 图片字段: Cover_Image_URL ×6 + Avatar_Image_URL ×3';
PRINT '    - 账户: Store_Manager (store_mgr) ×1';
PRINT '    - Discount_Usage_Log: +1';
PRINT '    - System_Audit_Log: +21';
PRINT '    - Payment: Refund×1 + Adjustment×1 + Member_Balance×1';
PRINT '    - Session_Consumption: +5 (Sessions 104, 108)';
PRINT '    - Inventory_Movement: Purchase_In×3 + Damage_Loss×1 + Inventory_Adjust×1';
PRINT '    - Coupons: +3 实例';
PRINT '    - Points: Earn_Manual×2 + Redeem_Gift×1 + Adjust×1';
PRINT '    - KPI_Snapshot: 补齐历史 06-01/06-02';
PRINT '    - DM_Shifts: 延伸至 06-05';
PRINT '    - Notifications: +8 (覆盖全7种类型)';
PRINT '    - Sessions: +4 (06-04当天，含Aborted)';
PRINT '    - Reviews: +4 (含低分/匿名)';
PRINT '    - Member_Profile: Store_Manager ×1';
PRINT '============================================';
GO

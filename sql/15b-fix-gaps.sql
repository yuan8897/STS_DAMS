-- =============================================
-- 15-fill-data-gaps.sql 修复补丁
-- 修复首次执行中因约束/架构不一致导致的失败
-- =============================================
USE STS_DAMS;
GO

SET QUOTED_IDENTIFIER ON;
GO

PRINT '============================================';
PRINT '  数据缺口填充 - 修复补丁';
PRINT '============================================';
GO

-- =============================================
-- 修复1：添加 Store_Manager 角色到查找表
-- =============================================
IF NOT EXISTS (SELECT 1 FROM Dim_Role_Lookup WHERE Role_Name = 'Store_Manager')
BEGIN
    SET IDENTITY_INSERT Dim_Role_Lookup ON;
    INSERT INTO Dim_Role_Lookup (Role_ID, Role_Name) VALUES (4, 'Store_Manager');
    SET IDENTITY_INSERT Dim_Role_Lookup OFF;
    PRINT '  ✓ Dim_Role_Lookup: Store_Manager (Role_ID=4) 已添加';
END
ELSE
    PRINT '  → Store_Manager 角色已存在';
GO

-- =============================================
-- 修复2：创建 Store_Manager 种子账户
-- =============================================
-- WARNING: 种子密码使用占位符 '123456'。
-- 生产部署后必须运行: cd sts-dams-backend && node scripts/reset-passwords.js --random
IF NOT EXISTS (SELECT 1 FROM Account_Base_Table WHERE Account_Name = 'store_mgr')
BEGIN
    SET IDENTITY_INSERT Account_Base_Table ON;
    INSERT INTO Account_Base_Table (User_ID, Account_Name, Password_Hash, Contact_Phone, Role_Type, Account_Status)
    VALUES (9, 'store_mgr', HASHBYTES('SHA2_256', CONCAT('store_mgr', ':', '123456')), '+8613800000009', 4, 'Active');
    SET IDENTITY_INSERT Account_Base_Table OFF;
    PRINT '  ✓ Store_Manager 账户 store_mgr 已创建 (User_ID=9)';
END
ELSE
    PRINT '  → store_mgr 账户已存在';
GO

-- =============================================
-- 修复3：剧本封面 URL 更新（QUOTED_IDENTIFIER ON）
-- =============================================
UPDATE Dim_Script_Dictionary SET Cover_Image_URL = '/api/upload/file/cover_kunlun.jpg'   WHERE Script_ID = 1 AND Cover_Image_URL IS NULL;
UPDATE Dim_Script_Dictionary SET Cover_Image_URL = '/api/upload/file/cover_matsuko.jpg'   WHERE Script_ID = 2 AND Cover_Image_URL IS NULL;
UPDATE Dim_Script_Dictionary SET Cover_Image_URL = '/api/upload/file/cover_suspect7.jpg'  WHERE Script_ID = 3 AND Cover_Image_URL IS NULL;
UPDATE Dim_Script_Dictionary SET Cover_Image_URL = '/api/upload/file/cover_call.jpg'      WHERE Script_ID = 4 AND Cover_Image_URL IS NULL;
UPDATE Dim_Script_Dictionary SET Cover_Image_URL = '/api/upload/file/cover_snow.jpg'      WHERE Script_ID = 5 AND Cover_Image_URL IS NULL;
UPDATE Dim_Script_Dictionary SET Cover_Image_URL = '/api/upload/file/cover_lichuan.jpg'   WHERE Script_ID = 6 AND Cover_Image_URL IS NULL;
PRINT '  ✓ 剧本封面 URL 已更新';
GO

-- =============================================
-- 修复4：DM 头像 URL 更新
-- =============================================
UPDATE DM_Profile_Table SET Avatar_Image_URL = '/api/upload/file/dm_ye_avatar.png'  WHERE DM_User_ID = 2 AND Avatar_Image_URL IS NULL;
UPDATE DM_Profile_Table SET Avatar_Image_URL = '/api/upload/file/dm_chen_avatar.png' WHERE DM_User_ID = 3 AND Avatar_Image_URL IS NULL;
UPDATE DM_Profile_Table SET Avatar_Image_URL = '/api/upload/file/dm_lin_avatar.png'  WHERE DM_User_ID = 4 AND Avatar_Image_URL IS NULL;
PRINT '  ✓ DM 头像 URL 已更新';
GO

-- =============================================
-- 修复5：每日 KPI 快照 — 使用实际列名
-- =============================================
-- 实际列: Snapshot_ID, Store_ID, Snapshot_Date, Total_Sessions,
--   Completed_Sessions, Aborted_Sessions, Total_Revenue_Script,
--   Total_Revenue_Consumption, Total_Refund, Active_Players,
--   New_Registrations, Created_At

IF NOT EXISTS (SELECT 1 FROM Daily_KPI_Snapshot WHERE Snapshot_Date = '2026-06-01')
BEGIN
    INSERT INTO Daily_KPI_Snapshot (Store_ID, Snapshot_Date, Total_Sessions, Completed_Sessions, Aborted_Sessions, Total_Revenue_Script, Total_Revenue_Consumption, Total_Refund, Active_Players, New_Registrations)
    VALUES (1, '2026-06-01', 3, 2, 1, 1200.00, 360.00, 0, 9, 2);
    PRINT '  ✓ KPI 快照 06-01 已添加';
END
GO

IF NOT EXISTS (SELECT 1 FROM Daily_KPI_Snapshot WHERE Snapshot_Date = '2026-06-02')
BEGIN
    INSERT INTO Daily_KPI_Snapshot (Store_ID, Snapshot_Date, Total_Sessions, Completed_Sessions, Aborted_Sessions, Total_Revenue_Script, Total_Revenue_Consumption, Total_Refund, Active_Players, New_Registrations)
    VALUES (1, '2026-06-02', 4, 3, 0, 1680.00, 420.00, 100.00, 12, 3);
    PRINT '  ✓ KPI 快照 06-02 已添加';
END
GO

-- 更新 06-03 数据（用实际列名）
UPDATE Daily_KPI_Snapshot
SET Total_Sessions = 4, Completed_Sessions = 2, Aborted_Sessions = 0,
    Total_Revenue_Script = 1520.00, Total_Revenue_Consumption = 330.00,
    Total_Refund = 0, Active_Players = 10, New_Registrations = 1
WHERE Snapshot_Date = '2026-06-03'
  AND Total_Revenue_Script IS NULL;
PRINT '  ✓ KPI 快照 06-03 已确认';
GO

-- =============================================
-- 修复6：今日场次 — 避开 Under_Maintenance 房间
-- =============================================
-- 房间5为 Under_Maintenance，改用房间3 (民国老上海)
-- Session 111: DM=4 (林深), Script=5 (雪乡 via Copy), 需要检查DM能力

-- 先确认 DM 4 对 Script 5 的能力
-- DM 4 (林深) has Script 5 Trained per seed data

IF NOT EXISTS (SELECT 1 FROM Fact_Session_Schedule WHERE Session_ID = 109)
BEGIN
    SET IDENTITY_INSERT Fact_Session_Schedule ON;
    -- 109: 夜雨+昆仑+日式 (OK)
    INSERT INTO Fact_Session_Schedule (Session_ID, Copy_ID, Room_ID, DM_User_ID, Scheduled_Start_Time, Scheduled_End_Time, Session_Status, Frozen_Per_Head_Price, Created_By_User_ID)
    VALUES (109, 1, 1, 2, '2026-06-04T14:00:00', '2026-06-04T19:00:00', 'Matching', 198.00, 1);
    SET IDENTITY_INSERT Fact_Session_Schedule OFF;
    PRINT '  ✓ Session 109 已创建';
END
GO

IF NOT EXISTS (SELECT 1 FROM Fact_Session_Schedule WHERE Session_ID = 110)
BEGIN
    SET IDENTITY_INSERT Fact_Session_Schedule ON;
    -- 110: 沉渊+第七号嫌疑人(Copy3)+民国 (OK)
    INSERT INTO Fact_Session_Schedule (Session_ID, Copy_ID, Room_ID, DM_User_ID, Scheduled_Start_Time, Scheduled_End_Time, Session_Status, Frozen_Per_Head_Price, Created_By_User_ID)
    VALUES (110, 3, 3, 3, '2026-06-04T15:00:00', '2026-06-04T18:30:00', 'Locked_Ready', 188.00, 1);
    SET IDENTITY_INSERT Fact_Session_Schedule OFF;
    PRINT '  ✓ Session 110 已创建';
END
GO

IF NOT EXISTS (SELECT 1 FROM Fact_Session_Schedule WHERE Session_ID = 111)
BEGIN
    -- 111: 林深+漓川(Copy5)+欧式古堡房(2)
    SET IDENTITY_INSERT Fact_Session_Schedule ON;
    INSERT INTO Fact_Session_Schedule (Session_ID, Copy_ID, Room_ID, DM_User_ID, Scheduled_Start_Time, Scheduled_End_Time, Session_Status, Frozen_Per_Head_Price, Created_By_User_ID)
    VALUES (111, 5, 2, 4, '2026-06-04T14:00:00', '2026-06-04T18:30:00', 'Matching', 188.00, 1);
    SET IDENTITY_INSERT Fact_Session_Schedule OFF;
    PRINT '  ✓ Session 111 已创建';
END
GO

-- Aborted 场次
IF NOT EXISTS (SELECT 1 FROM Fact_Session_Schedule WHERE Session_ID = 112)
BEGIN
    SET IDENTITY_INSERT Fact_Session_Schedule ON;
    INSERT INTO Fact_Session_Schedule (Session_ID, Copy_ID, Room_ID, DM_User_ID, Scheduled_Start_Time, Scheduled_End_Time, Session_Status, Frozen_Per_Head_Price, Created_By_User_ID)
    VALUES (112, 2, 2, 4, '2026-06-04T10:00:00', '2026-06-04T14:00:00', 'Aborted', 168.00, 1);
    SET IDENTITY_INSERT Fact_Session_Schedule OFF;
    PRINT '  ✓ Session 112 (Aborted) 已创建';
END
GO

-- 参团登记 (109-112)
IF NOT EXISTS (SELECT 1 FROM Bridge_Player_Registration WHERE Session_ID = 109)
BEGIN
    INSERT INTO Bridge_Player_Registration (Session_ID, Player_User_ID, Role_ID, Cached_Payment_Status)
    VALUES
        (109, 5, NULL, 'Deposit_Paid'),
        (109, 7, 2,    'Unpaid');
    PRINT '  ✓ Session 109 参团已添加';
END

IF NOT EXISTS (SELECT 1 FROM Bridge_Player_Registration WHERE Session_ID = 110)
BEGIN
    INSERT INTO Bridge_Player_Registration (Session_ID, Player_User_ID, Role_ID, Cached_Payment_Status)
    VALUES
        (110, 5, 12,   'Fully_Paid'),
        (110, 6, 14,   'Fully_Paid'),
        (110, 8, 15,   'Fully_Paid');
    PRINT '  ✓ Session 110 参团已添加';
END

IF NOT EXISTS (SELECT 1 FROM Bridge_Player_Registration WHERE Session_ID = 111)
BEGIN
    INSERT INTO Bridge_Player_Registration (Session_ID, Player_User_ID, Role_ID, Cached_Payment_Status)
    VALUES
        (111, 6, 21,   'Fully_Paid'),
        (111, 7, NULL, 'Deposit_Paid');
    PRINT '  ✓ Session 111 参团已添加';
END

IF NOT EXISTS (SELECT 1 FROM Bridge_Player_Registration WHERE Session_ID = 112)
BEGIN
    INSERT INTO Bridge_Player_Registration (Session_ID, Player_User_ID, Role_ID, Cached_Payment_Status)
    VALUES
        (112, 5, 9,    'Fully_Paid'),
        (112, 8, 10,   'Unpaid');
    PRINT '  ✓ Session 112 参团已添加';
END
GO

-- =============================================
-- 修复7：Store_Manager 会员档案
-- =============================================
IF NOT EXISTS (SELECT 1 FROM User_Member_Profile WHERE User_ID = 9)
BEGIN
    INSERT INTO User_Member_Profile (User_ID, Accumulated_Points, Current_Level_ID, Total_Lifetime_Points)
    VALUES (9, 300, 1, 300);
    PRINT '  ✓ Store_Manager 会员档案已创建';
END
GO

-- =============================================
-- 修复8：补充 Refund 支付（Payment 1 -> Refund via registration 1 → session 101）
-- =============================================
IF NOT EXISTS (SELECT 1 FROM Payment_Transaction_Table WHERE Transaction_Type = 'Refund')
BEGIN
    INSERT INTO Payment_Transaction_Table (Registration_ID, Transaction_Type, Amount, Payment_Method, Operator_User_ID, Remarks, Processed_At)
    VALUES (1, 'Refund', -100.00, 'WeChat', 1, N'玩家取消参团-退还订金', '2026-06-02T11:00:00');
    PRINT '  ✓ Refund 支付已添加';
END
GO

-- =============================================
-- 修复9：补充 Adjustment 支付
-- =============================================
IF NOT EXISTS (SELECT 1 FROM Payment_Transaction_Table WHERE Transaction_Type = 'Adjustment')
BEGIN
    INSERT INTO Payment_Transaction_Table (Registration_ID, Transaction_Type, Amount, Payment_Method, Operator_User_ID, Remarks, Processed_At)
    VALUES (5, 'Adjustment', 20.00, 'Cash', 1, N'DM绩效奖励调整', '2026-06-02T18:00:00');
    PRINT '  ✓ Adjustment 支付已添加';
END
GO

-- =============================================
-- 修复10：补充 Member_Balance 支付
-- =============================================
IF NOT EXISTS (SELECT 1 FROM Payment_Transaction_Table WHERE Payment_Method = 'Member_Balance')
BEGIN
    INSERT INTO Payment_Transaction_Table (Registration_ID, Transaction_Type, Amount, Payment_Method, Operator_User_ID, Remarks, Processed_At)
    VALUES (7, 'Final_Payment', 88.00, 'Member_Balance', 3, N'使用会员积分抵扣后余额支付', '2026-06-03T15:00:00');
    PRINT '  ✓ Member_Balance 支付已添加';
END
GO

PRINT '============================================';
PRINT '  修复补丁执行完成!';
PRINT '============================================';
GO

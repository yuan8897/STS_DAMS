-- =============================================
-- 扩展模块种子数据（仅空表部分）
-- 2026-06-02 | 核心表已有数据，仅填充扩展表
-- =============================================
USE STS_DAMS;
GO

-- ========== 场次种子数据 ==========
IF NOT EXISTS (SELECT 1 FROM Fact_Session_Schedule)
BEGIN
    SET IDENTITY_INSERT Fact_Session_Schedule ON;
    INSERT INTO Fact_Session_Schedule (Session_ID, Copy_ID, Room_ID, DM_User_ID, Scheduled_Start_Time, Scheduled_End_Time, Session_Status, Frozen_Per_Head_Price, Created_By_User_ID)
    VALUES
        (101, 1, 1, 2, '2026-06-02T14:00:00', '2026-06-02T19:00:00', 'Matching',      198.00, 1),
        (102, 2, 2, 4, '2026-06-02T14:00:00', '2026-06-02T18:00:00', 'Matching',      168.00, 1),
        (103, 3, 3, 3, '2026-06-02T18:00:00', '2026-06-02T22:30:00', 'In_Progress',  188.00, 1),
        (104, 4, 4, 4, '2026-06-02T19:00:00', '2026-06-02T23:00:00', 'Locked_Ready', 158.00, 1);
    SET IDENTITY_INSERT Fact_Session_Schedule OFF;

    INSERT INTO Bridge_Player_Registration (Session_ID, Player_User_ID, Role_ID, Cached_Payment_Status)
    VALUES
        (101, 5, NULL, 'Deposit_Paid'), (101, 6, 6, 'Fully_Paid'), (101, 7, 1, 'Unpaid'),
        (102, 5, 8, 'Fully_Paid'),     (102, 8, NULL, 'Unpaid'),
        (103, 5, 13, 'Fully_Paid'),    (103, 6, 15, 'Fully_Paid'),
        (103, 7, 14, 'Fully_Paid'),    (103, 8, 12, 'Deposit_Paid'),
        (104, 5, NULL, 'Fully_Paid'),  (104, 6, NULL, 'Fully_Paid'), (104, 7, NULL, 'Deposit_Paid');
END;
GO

-- ========== 会员等级 ==========
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

-- ========== 会员档案 ==========
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

-- ========== 积分流水 ==========
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

-- ========== 优惠券模板 ==========
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

-- ========== 优惠券实例 ==========
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

-- ========== 服务评价 ==========
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

-- ========== 消息通知 ==========
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

-- ========== 门店信息 ==========
IF NOT EXISTS (SELECT 1 FROM Dim_Store_Info)
BEGIN
    INSERT INTO Dim_Store_Info (Store_ID, Store_Name, Store_Address, Contact_Phone, Contact_Email, Business_Hours)
    VALUES (1, 'STS 剧本杀推理馆', '上海市黄浦区南京东路 128 号 3F', '021-6888-0001', 'contact@sts-dams.cn', '周一至周五 12:00-02:00 / 周末 10:00-02:00');
END;
GO

PRINT 'All expansion seed data inserted.';
GO

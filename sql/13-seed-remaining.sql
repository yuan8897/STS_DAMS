-- =============================================
-- 补充种子数据（场次已就位，补登记/积分/评价/通知/门店）
-- =============================================
USE STS_DAMS;
GO

SET QUOTED_IDENTIFIER ON;
GO

-- =============================================
-- 补充种子数据（幂等版本 — 所有 INSERT 带 IF NOT EXISTS 保护）
-- 与 12-seed-expansion-only.sql 可任意顺序/重复执行
-- =============================================
USE STS_DAMS;
GO

SET QUOTED_IDENTIFIER ON;
GO

-- 参团登记（幂等：仅当该场次尚无参团记录时插入）
IF NOT EXISTS (SELECT 1 FROM Bridge_Player_Registration WHERE Session_ID IN (101, 102, 103, 104))
BEGIN
    INSERT INTO Bridge_Player_Registration (Session_ID, Player_User_ID, Role_ID, Cached_Payment_Status)
    VALUES
        (101, 5, NULL, 'Deposit_Paid'), (101, 6, 6, 'Fully_Paid'), (101, 7, 1, 'Unpaid'),
        (102, 5, 8, 'Fully_Paid'),     (102, 8, NULL, 'Unpaid'),
        (103, 5, 13, 'Fully_Paid'),    (103, 6, 15, 'Fully_Paid'),
        (103, 7, 14, 'Fully_Paid'),    (103, 8, 12, 'Deposit_Paid'),
        (104, 5, NULL, 'Fully_Paid'),  (104, 6, NULL, 'Fully_Paid'), (104, 7, NULL, 'Deposit_Paid');
END;
GO

-- 积分流水（幂等：仅当该用户尚无积分流水时插入）
IF NOT EXISTS (SELECT 1 FROM Member_Points_Ledger WHERE User_ID IN (5, 6, 7, 8))
BEGIN
    INSERT INTO Member_Points_Ledger (User_ID, Points_Delta, Transaction_Type, Related_Session_ID, Points_Balance_After, Operator_User_ID, Remarks, Created_At)
    VALUES
        (5, 100,  'Earn_Session',      101, 2350, 1, NULL,                 '2026-06-02T14:00:00'),
        (5, 50,   'Earn_Consumption',  103, 2250, 2, NULL,                 '2026-06-02T18:30:00'),
        (5, -500, 'Redeem_Cash',       NULL, 2200, 2, N'积分兑换抵扣 ¥5.00', '2026-06-02T14:30:00'),
        (6, 100,  'Earn_Session',      103, 680,  1, NULL,                 '2026-06-02T13:00:00'),
        (6, 60,   'Earn_Consumption',  103, 580,  2, NULL,                 '2026-06-02T19:00:00'),
        (7, 100,  'Earn_Session',      101, 200,  1, NULL,                 '2026-06-02T14:00:00'),
        (8, 100,  'Earn_Session',      103, 5800, 1, NULL,                 '2026-06-02T13:00:00'),
        (8, -1000,'Redeem_Cash',       NULL, 5700, 2, N'积分兑换抵扣 ¥10.00','2026-06-02T15:00:00');
END;
GO

-- 服务评价（幂等：仅当尚无评价时插入）
IF NOT EXISTS (SELECT 1 FROM Fact_Session_Review)
BEGIN
    SET IDENTITY_INSERT Fact_Session_Review ON;
    INSERT INTO Fact_Session_Review (Review_ID, Session_ID, Reviewer_User_ID, Registration_ID, DM_Rating, Script_Rating, Room_Rating, Overall_Rating, Review_Comment, Tags, Is_Anonymous, Created_At)
    VALUES
        (1, 101, 5, 1, 5, 4, 4, 4, N'夜雨DM带场非常专业，沉浸感很强！',             N'DM入戏深,氛围感强',                             0, '2026-06-02T19:30:00'),
        (2, 101, 6, 2, 4, 5, 4, 5, N'昆仑剧本太精彩了，推理层层递进！',               N'推理烧脑,DM入戏深',                             0, '2026-06-02T19:45:00'),
        (3, 102, 5, 4, 5, 5, 3, 4, N'松子的故事太催泪了，哭到停不下来',               N'情感催泪',                                       1, '2026-06-02T18:15:00'),
        (4, 103, 5, 6, 5, 5, 4, 5, N'沉渊DM演技炸裂，案件设计巧妙，强烈推荐！',       N'推理烧脑,DM入戏深,氛围感强',                    0, '2026-06-02T22:45:00'),
        (5, 103, 6, 7, 4, 4, 5, 4, N'房间布置很有民国氛围，体验很棒',                 N'氛围感强',                                       0, '2026-06-02T23:00:00'),
        (6, 103, 8, 9, 5, 5, 5, 5, N'年度最佳剧本杀体验！各方面都完美',               N'推理烧脑,DM入戏深,氛围感强',                    0, '2026-06-02T23:15:00');
    SET IDENTITY_INSERT Fact_Session_Review OFF;
END;
GO

-- 消息通知（幂等：仅当尚无通知时插入）
IF NOT EXISTS (SELECT 1 FROM User_Notification)
BEGIN
    INSERT INTO User_Notification (Recipient_User_ID, Notification_Type, Title, Content, Related_Entity_Type, Related_Entity_ID, Is_Read, Created_At)
    VALUES
        (5, 'Session_Reminder', N'新场次发布',    N'今晚 19:00 《来电》现代办公房 正在拼车中！',            'Fact_Session_Schedule', '104', 0, '2026-06-02T07:00:00'),
        (5, 'Session_Reminder', N'拼车成功',      N'你参团的《第七号嫌疑人》已锁车，请按时到场',             'Fact_Session_Schedule', '103', 0, '2026-06-02T14:30:00'),
        (7, 'Payment_Confirm',  N'支付提醒',      N'你在《昆仑》场次的参团费用尚未支付，请及时完成支付',     'Bridge_Player_Registration', '3', 0, '2026-06-02T10:30:00'),
        (1, 'Low_Stock_Alert',  N'库存预警',      N'商品话梅当前库存仅剩 3 件，低于安全预警红线',            'Dim_Inventory_Item', '5', 1, '2026-06-02T18:00:00'),
        (1, 'Session_Reminder', N'流局风险',      N'《被嫌弃的松子的一生》开场前 2 小时仍不满足最低人数 3 人','Fact_Session_Schedule', '102', 1, '2026-06-02T14:00:00');
END;
GO

-- 门店信息（幂等：仅当尚无门店信息时插入）
IF NOT EXISTS (SELECT 1 FROM Dim_Store_Info)
BEGIN
    INSERT INTO Dim_Store_Info (Store_ID, Store_Name, Store_Address, Contact_Phone, Contact_Email, Business_Hours)
    VALUES (1, N'STS 剧本杀推理馆', N'上海市黄浦区南京东路 128 号 3F', '021-6888-0001', 'contact@sts-dams.cn', N'周一至周五 12:00-02:00 / 周末 10:00-02:00');
END;
GO

PRINT 'All remaining seed data inserted (idempotent).';
GO

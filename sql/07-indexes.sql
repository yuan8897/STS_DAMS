SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE STS_DAMS;
GO

-- =============================================
-- 全部索引定义（2.8 节）
-- =============================================

-- 清理可能部分创建的索引
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Session_Room_TimeRange')
    DROP INDEX IX_Session_Room_TimeRange ON Fact_Session_Schedule;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Session_DM_TimeRange')
    DROP INDEX IX_Session_DM_TimeRange ON Fact_Session_Schedule;
GO

-- 时空冲突检测覆盖索引（Filtered Index）—— 房间维度
CREATE NONCLUSTERED INDEX IX_Session_Room_TimeRange
    ON Fact_Session_Schedule(Room_ID, Scheduled_Start_Time, Scheduled_End_Time)
    INCLUDE (Session_Status, DM_User_ID)
    WHERE Session_Status NOT IN ('Aborted', 'Completed');
GO

-- 时空冲突检测覆盖索引（Filtered Index）—— DM 维度
CREATE NONCLUSTERED INDEX IX_Session_DM_TimeRange
    ON Fact_Session_Schedule(DM_User_ID, Scheduled_Start_Time, Scheduled_End_Time)
    INCLUDE (Session_Status, Room_ID)
    WHERE Session_Status NOT IN ('Aborted', 'Completed');
GO

-- 清理拼车列表索引
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Session_MatchingList')
    DROP INDEX IX_Session_MatchingList ON Fact_Session_Schedule;
GO

-- 拼车列表查询索引（Filtered Index）
CREATE NONCLUSTERED INDEX IX_Session_MatchingList
    ON Fact_Session_Schedule(Session_Status, Scheduled_Start_Time DESC)
    WHERE Session_Status = 'Matching';
GO

-- DM 可用性查询索引
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DM_Shift_Query')
    CREATE NONCLUSTERED INDEX IX_DM_Shift_Query
        ON DM_Shift_Availability_Table(DM_User_ID, Available_Start, Available_End);
GO

-- 支付对账索引
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Payment_Reconciliation')
    CREATE NONCLUSTERED INDEX IX_Payment_Reconciliation
        ON Payment_Transaction_Table(Processed_At, Transaction_Type)
        INCLUDE (Amount);
GO

-- 库存流水按商品聚合索引
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Inventory_ItemTimeline')
    CREATE NONCLUSTERED INDEX IX_Inventory_ItemTimeline
        ON Inventory_Movement_Ledger(Item_ID, Movement_At DESC)
        INCLUDE (Quantity_Delta);
GO

-- DM 能力查询索引
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DM_Capability_Script')
    CREATE NONCLUSTERED INDEX IX_DM_Capability_Script
        ON DM_Script_Capability_Table(Script_ID)
        INCLUDE (DM_User_ID, Proficiency_Level);
GO

-- 玩家参团查询索引
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Registration_Session')
    CREATE NONCLUSTERED INDEX IX_Registration_Session
        ON Bridge_Player_Registration(Session_ID)
        INCLUDE (Player_User_ID, Role_ID, Cached_Payment_Status);
GO

-- 角色过滤唯一索引
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_Session_Role_Filtered')
    DROP INDEX UQ_Session_Role_Filtered ON Bridge_Player_Registration;
GO

CREATE UNIQUE NONCLUSTERED INDEX UQ_Session_Role_Filtered
    ON Bridge_Player_Registration(Session_ID, Role_ID)
    WHERE Role_ID IS NOT NULL;
GO

PRINT 'All indexes created.';
GO

-- =============================================
-- 补充索引（审核后添加）
-- =============================================

-- T7 触发器 Payment_Transaction_Table.Registration_ID 聚合查询优化
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Payment_Registration')
    CREATE NONCLUSTERED INDEX IX_Payment_Registration
        ON Payment_Transaction_Table(Registration_ID)
        INCLUDE (Amount, Transaction_Type);
GO

-- 场次消费明细查询优化
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Consumption_Session')
    CREATE NONCLUSTERED INDEX IX_Consumption_Session
        ON Fact_Session_Consumption(Session_ID)
        INCLUDE (Item_ID, Consumed_Quantity, Line_Total_Cost);
GO

-- 查询"某玩家所有场次"索引（避免全表扫描 Bridge_Player_Registration）
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Registration_Player')
    CREATE NONCLUSTERED INDEX IX_Registration_Player
        ON Bridge_Player_Registration(Player_User_ID)
        INCLUDE (Session_ID, Role_ID, Cached_Payment_Status);
GO

-- 审计日志时间范围查询索引
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Audit_LoggedAt')
    CREATE NONCLUSTERED INDEX IX_Audit_LoggedAt
        ON System_Audit_Log_Table(Logged_At DESC)
        INCLUDE (Action_Type, Target_Entity, Operator_User_ID);
GO

PRINT 'Supplementary indexes created.';
GO

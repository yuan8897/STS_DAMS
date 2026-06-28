-- =============================================
-- 全部触发器定义（2.9 节）
-- SET ANSI_NULLS ON / QUOTED_IDENTIFIER ON 是创建索引视图相关对象的前置条件
-- =============================================
USE STS_DAMS;
GO

-- ========== 触发器 1：时空冲突硬性拦截 ==========
IF EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'trg_Session_NoTimeOverlap')
    DROP TRIGGER trg_Session_NoTimeOverlap;
GO

CREATE TRIGGER trg_Session_NoTimeOverlap
ON Fact_Session_Schedule
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1 FROM inserted i
        JOIN Fact_Session_Schedule s ON s.Session_ID <> i.Session_ID
        WHERE (s.Room_ID = i.Room_ID OR s.DM_User_ID = i.DM_User_ID)
          AND s.Scheduled_Start_Time < i.Scheduled_End_Time
          AND s.Scheduled_End_Time > i.Scheduled_Start_Time
          AND s.Session_Status NOT IN ('Aborted', 'Completed')
    )
    BEGIN
        RAISERROR('时空冲突：房间或 DM 在该时段已被占用', 16, 1);
        ROLLBACK TRANSACTION;
    END
END;
GO

-- ========== 触发器 2：DM 在职状态校验 ==========
IF EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'trg_Session_DM_EmploymentStatus')
    DROP TRIGGER trg_Session_DM_EmploymentStatus;
GO

CREATE TRIGGER trg_Session_DM_EmploymentStatus
ON Fact_Session_Schedule
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1 FROM inserted i
        JOIN DM_Profile_Table dm ON dm.DM_User_ID = i.DM_User_ID
        WHERE dm.Employment_Status NOT IN ('Active', 'Probation')
    )
    BEGIN
        RAISERROR('DM 在职状态异常：仅正式在职或试用期 DM 可被指派场次', 16, 1);
        ROLLBACK TRANSACTION;
    END
END;
GO

-- ========== 触发器 3：DM 排班可用性校验 ==========
IF EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'trg_Session_DM_ShiftAvailability')
    DROP TRIGGER trg_Session_DM_ShiftAvailability;
GO

CREATE TRIGGER trg_Session_DM_ShiftAvailability
ON Fact_Session_Schedule
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1 FROM inserted i
        WHERE NOT EXISTS (
            SELECT 1 FROM DM_Shift_Availability_Table shift
            WHERE shift.DM_User_ID = i.DM_User_ID
              AND shift.Available_Start <= i.Scheduled_Start_Time
              AND shift.Available_End   >= i.Scheduled_End_Time
        )
    )
    BEGIN
        RAISERROR('DM 排班冲突：场次时间段不在 DM 的任何可用班次内', 16, 1);
        ROLLBACK TRANSACTION;
    END
END;
GO

-- ========== 触发器 4：DM 剧本能力校验 ==========
IF EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'trg_Session_DM_ScriptCapability')
    DROP TRIGGER trg_Session_DM_ScriptCapability;
GO

CREATE TRIGGER trg_Session_DM_ScriptCapability
ON Fact_Session_Schedule
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1 FROM inserted i
        JOIN Asset_Script_Copy_Table sc ON sc.Copy_ID = i.Copy_ID
        WHERE NOT EXISTS (
            SELECT 1 FROM DM_Script_Capability_Table cap
            WHERE cap.DM_User_ID = i.DM_User_ID
              AND cap.Script_ID = sc.Script_ID
        )
    )
    BEGIN
        RAISERROR('DM 能力不足：该 DM 不具备本场剧本的带场能力认证', 16, 1);
        ROLLBACK TRANSACTION;
    END
END;
GO

-- ========== 触发器 5：房间-剧本容量校验 ==========
IF EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'trg_Session_RoomScriptCapacity')
    DROP TRIGGER trg_Session_RoomScriptCapacity;
GO

CREATE TRIGGER trg_Session_RoomScriptCapacity
ON Fact_Session_Schedule
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1 FROM inserted i
        JOIN Asset_Script_Copy_Table sc ON sc.Copy_ID = i.Copy_ID
        JOIN Dim_Script_Dictionary sd ON sd.Script_ID = sc.Script_ID
        JOIN Dim_Store_Room r ON r.Room_ID = i.Room_ID
        WHERE sd.Max_Allowed_Players > r.Room_Max_Capacity
    )
    BEGIN
        RAISERROR('房间容量不足：剧本最大人数超过房间物理容纳上限', 16, 1);
        ROLLBACK TRANSACTION;
    END
END;
GO

-- ========== 触发器 6：消费-库存联动 ==========
IF EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'trg_Consumption_AutoLedger')
    DROP TRIGGER trg_Consumption_AutoLedger;
GO

CREATE TRIGGER trg_Consumption_AutoLedger
ON Fact_Session_Consumption
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    -- 预检：库存不足时提前返回友好错误消息（而非依赖 CHECK 约束报错）
    IF EXISTS (
        SELECT 1 FROM Dim_Inventory_Item inv
        JOIN (SELECT Item_ID, SUM(Consumed_Quantity) AS Total_Consumed FROM inserted GROUP BY Item_ID) agg
            ON agg.Item_ID = inv.Item_ID
        WHERE inv.Current_Stock_Cache < agg.Total_Consumed
    )
    BEGIN
        DECLARE @ItemList NVARCHAR(500) = '';
        SELECT @ItemList = @ItemList + inv.Item_Name + ' (库存' + CAST(inv.Current_Stock_Cache AS NVARCHAR) + ', 需求' + CAST(agg.Total_Consumed AS NVARCHAR) + '); '
        FROM Dim_Inventory_Item inv
        JOIN (SELECT Item_ID, SUM(Consumed_Quantity) AS Total_Consumed FROM inserted GROUP BY Item_ID) agg
            ON agg.Item_ID = inv.Item_ID
        WHERE inv.Current_Stock_Cache < agg.Total_Consumed;
        RAISERROR('库存不足：%s', 16, 1, @ItemList);
        ROLLBACK TRANSACTION;
        RETURN;
    END

    -- 步骤 1：写入库存出库流水
    INSERT INTO Inventory_Movement_Ledger
        (Item_ID, Quantity_Delta, Movement_Type, Related_Session_ID,
         Related_Consumption_ID, Operator_User_ID, Movement_At)
    SELECT i.Item_ID, -i.Consumed_Quantity, 'Sale_Out',
           i.Session_ID, i.Consumption_ID, i.Recording_DM_User_ID, i.Recorded_At
    FROM inserted i;

    -- 步骤 2：扣减库存缓存（UPDLOCK 防止并发写冲突，先 GROUP BY 再 UPDATE）
    UPDATE inv
    SET inv.Current_Stock_Cache = inv.Current_Stock_Cache - agg.Total_Consumed
    FROM Dim_Inventory_Item inv WITH (UPDLOCK)
    JOIN (SELECT Item_ID, SUM(Consumed_Quantity) AS Total_Consumed FROM inserted GROUP BY Item_ID) agg
        ON agg.Item_ID = inv.Item_ID;
END;
GO

-- ========== 触发器 7：支付状态同步 ==========
IF EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'trg_Payment_SyncCachedStatus')
    DROP TRIGGER trg_Payment_SyncCachedStatus;
GO

CREATE TRIGGER trg_Payment_SyncCachedStatus
ON Payment_Transaction_Table
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE reg
    SET Cached_Payment_Status =
        CASE WHEN total_paid.Amount >= sched.Frozen_Per_Head_Price THEN 'Fully_Paid'
             WHEN total_paid.Amount > 0 THEN 'Deposit_Paid'
             ELSE 'Unpaid'
        END
    FROM Bridge_Player_Registration reg
    JOIN inserted i ON i.Registration_ID = reg.Registration_ID
    JOIN Fact_Session_Schedule sched ON sched.Session_ID = reg.Session_ID
    CROSS APPLY (
        SELECT ISNULL(SUM(Amount), 0) AS Amount
        FROM Payment_Transaction_Table
        WHERE Registration_ID = i.Registration_ID
          AND Transaction_Type IN ('Deposit', 'Final_Payment', 'Adjustment', 'Refund')
    ) total_paid;
END;
GO

-- ========== 触发器 8：审计日志强制写入（Fact_Session_Schedule UPDATE） ==========
IF EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'trg_Audit_SessionUpdate')
    DROP TRIGGER trg_Audit_SessionUpdate;
GO

CREATE TRIGGER trg_Audit_SessionUpdate
ON Fact_Session_Schedule
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO System_Audit_Log_Table
        (Store_ID, Operator_User_ID, Action_Type, Target_Entity,
         Target_Record_ID, Action_Details, Client_IP, Logged_At)
    SELECT 1,
           ISNULL(CAST(CAST(CONTEXT_INFO() AS BINARY(4)) AS INT), 1), -- 从 CONTEXT_INFO 读取操作人 User_ID（NULL 时回退 admin=1）
           'UPDATE_SESSION', 'Fact_Session_Schedule',
           CAST(i.Session_ID AS NVARCHAR(50)),
           (SELECT i.Session_Status AS new_status,
                   d.Session_Status AS old_status
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
           ISNULL(CAST(SUBSTRING(CONTEXT_INFO(), 5, 45) AS NVARCHAR(45)), N'0.0.0.0'), -- 读取 Client_IP（NULL 时回退）
           SYSUTCDATETIME()
    FROM inserted i
    JOIN deleted d ON i.Session_ID = d.Session_ID;
END;
GO

-- ========== 触发器 9：场次完成 → 自动发放积分 ==========
IF EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'trg_Session_Complete_GrantPoints')
    DROP TRIGGER trg_Session_Complete_GrantPoints;
GO

CREATE TRIGGER trg_Session_Complete_GrantPoints
ON Fact_Session_Schedule
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF UPDATE(Session_Status)
    BEGIN
        -- 对本次变为 Completed 的场次，每位参团玩家 +100 基础分
        INSERT INTO Member_Points_Ledger
            (User_ID, Points_Delta, Transaction_Type, Related_Session_ID,
             Points_Balance_After, Operator_User_ID)
        SELECT
            reg.Player_User_ID,
            100,
            'Earn_Session',
            ins.Session_ID,
            ISNULL(prof.Accumulated_Points, 0) + 100,
            1
        FROM inserted ins
        JOIN deleted del ON ins.Session_ID = del.Session_ID
        JOIN Bridge_Player_Registration reg ON ins.Session_ID = reg.Session_ID
        LEFT JOIN User_Member_Profile prof ON reg.Player_User_ID = prof.User_ID
        WHERE del.Session_Status <> 'Completed'
          AND ins.Session_Status = 'Completed';

        -- 同时更新会员档案的累积积分
        UPDATE prof
        SET Accumulated_Points = ISNULL(prof.Accumulated_Points, 0) + 100,
            Total_Lifetime_Points = ISNULL(prof.Total_Lifetime_Points, 0) + 100
        FROM User_Member_Profile prof
        WHERE prof.User_ID IN (
            SELECT reg.Player_User_ID
            FROM inserted ins
            JOIN deleted del ON ins.Session_ID = del.Session_ID
            JOIN Bridge_Player_Registration reg ON ins.Session_ID = reg.Session_ID
            WHERE del.Session_Status <> 'Completed'
              AND ins.Session_Status = 'Completed'
        );

        -- 积分更新后重新计算会员等级（避免 T10 读到旧积分的时序问题）
        UPDATE prof
        SET Current_Level_ID = (
                SELECT TOP 1 lvl.Level_ID
                FROM Dim_Member_Level lvl
                WHERE lvl.Min_Required_Points <= ISNULL(prof.Accumulated_Points, 0)
                ORDER BY lvl.Min_Required_Points DESC
            ),
            Level_Upgraded_At = CASE
                WHEN prof.Current_Level_ID <> (
                    SELECT TOP 1 lvl.Level_ID
                    FROM Dim_Member_Level lvl
                    WHERE lvl.Min_Required_Points <= ISNULL(prof.Accumulated_Points, 0)
                    ORDER BY lvl.Min_Required_Points DESC
                ) THEN SYSUTCDATETIME()
                ELSE prof.Level_Upgraded_At
            END
        FROM User_Member_Profile prof
        WHERE prof.User_ID IN (
            SELECT reg.Player_User_ID
            FROM inserted ins
            JOIN deleted del ON ins.Session_ID = del.Session_ID
            JOIN Bridge_Player_Registration reg ON ins.Session_ID = reg.Session_ID
            WHERE del.Session_Status <> 'Completed'
              AND ins.Session_Status = 'Completed'
        )
          AND ISNULL(prof.Accumulated_Points, 0) > 0;
    END
END;
GO

-- ========== 触发器 10：积分变动 → 自动重算会员等级 ==========
IF EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'trg_Points_UpdateMemberLevel')
    DROP TRIGGER trg_Points_UpdateMemberLevel;
GO

CREATE TRIGGER trg_Points_UpdateMemberLevel
ON Member_Points_Ledger
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    -- 对本次积分变动的用户，取满足 Min_Required_Points ≤ Accumulated_Points 的最高等级
    UPDATE prof
    SET Current_Level_ID = (
            SELECT TOP 1 lvl.Level_ID
            FROM Dim_Member_Level lvl
            WHERE lvl.Min_Required_Points <= prof.Accumulated_Points
            ORDER BY lvl.Min_Required_Points DESC
        ),
        Level_Upgraded_At = CASE
            WHEN prof.Current_Level_ID <> (
                SELECT TOP 1 lvl.Level_ID
                FROM Dim_Member_Level lvl
                WHERE lvl.Min_Required_Points <= prof.Accumulated_Points
                ORDER BY lvl.Min_Required_Points DESC
            ) THEN SYSUTCDATETIME()
            ELSE prof.Level_Upgraded_At
        END
    FROM User_Member_Profile prof
    WHERE prof.User_ID IN (SELECT DISTINCT User_ID FROM inserted);
END;
GO

PRINT 'All 10 triggers created.';
GO

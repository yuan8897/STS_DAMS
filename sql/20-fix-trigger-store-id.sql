-- =============================================
-- 修复 M-DB-6: trg_Audit_SessionUpdate 硬编码 Store_ID=1
-- =============================================
-- 问题: 触发器使用 SELECT 1 硬编码 Store_ID，不随场次门店变化。
-- 修复: 改为 SELECT i.Store_ID 从 inserted 虚拟表读取场次所属门店。
-- 操作: 删除旧触发器并重建。
-- =============================================
USE STS_DAMS;
GO

-- 删除旧触发器
IF EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'trg_Audit_SessionUpdate')
    DROP TRIGGER trg_Audit_SessionUpdate;
GO

-- 重建触发器 — Store_ID 从 inserted.Store_ID 读取（而非硬编码 1）
CREATE TRIGGER trg_Audit_SessionUpdate
ON Fact_Session_Schedule
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO System_Audit_Log_Table
        (Store_ID, Operator_User_ID, Action_Type, Target_Entity,
         Target_Record_ID, Action_Details, Client_IP, Logged_At)
    SELECT i.Store_ID,  -- 修复: 从场次记录读取门店 ID（原为 SELECT 1 硬编码）
           ISNULL(CAST(CAST(CONTEXT_INFO() AS BINARY(4)) AS INT), 1),  -- 修复: NULL 时回退 admin=1
           'UPDATE_SESSION', 'Fact_Session_Schedule',
           CAST(i.Session_ID AS NVARCHAR(50)),
           (SELECT i.Session_Status AS new_status,
                   d.Session_Status AS old_status
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
           ISNULL(CAST(SUBSTRING(CONTEXT_INFO(), 5, 45) AS NVARCHAR(45)), N'0.0.0.0'),  -- 修复: NULL 时回退
           SYSUTCDATETIME()
    FROM inserted i
    JOIN deleted d ON i.Session_ID = d.Session_ID;
END;
GO

PRINT 'trg_Audit_SessionUpdate rebuilt with i.Store_ID (was: SELECT 1).';
GO

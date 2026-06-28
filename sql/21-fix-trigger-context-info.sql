-- =============================================
-- 修复 M-DB-7: trg_Audit_SessionUpdate 未处理 CONTEXT_INFO = NULL
-- =============================================
-- 问题: 后端路由未调用 SET CONTEXT_INFO 时，CONTEXT_INFO() 返回 NULL，
--        CAST(NULL AS INT) → NULL → 违反 System_Audit_Log_Table.Operator_User_ID NOT NULL 约束
--       → 触发器 INSERT 失败 → ROLLBACK → 原 UPDATE 也被回滚 → DM 所有状态变更被阻塞
-- 修复:
--   1. Operator_User_ID 改用 ISNULL(..., 1) 回退到 admin (User_ID=1)
--   2. Client_IP 改用 ISNULL(..., '0.0.0.0') 回退
--   3. Store_ID 保持从 i.Store_ID 读取（已在 20-fix-trigger-store-id.sql 中修复）
-- 操作: 删除旧触发器并重建。
-- 依赖: 需与后端修复配合（sessions.js 中调用 setSessionContext）才能记录真实操作人
-- =============================================
USE STS_DAMS;
GO

-- 删除旧触发器
IF EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'trg_Audit_SessionUpdate')
    DROP TRIGGER trg_Audit_SessionUpdate;
GO

-- 重建触发器 — 防御性 CONTEXT_INFO 默认值
CREATE TRIGGER trg_Audit_SessionUpdate
ON Fact_Session_Schedule
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO System_Audit_Log_Table
        (Store_ID, Operator_User_ID, Action_Type, Target_Entity,
         Target_Record_ID, Action_Details, Client_IP, Logged_At)
    SELECT i.Store_ID,
           ISNULL(CAST(CAST(CONTEXT_INFO() AS BINARY(4)) AS INT), 1),  -- 回退 admin=1
           'UPDATE_SESSION', 'Fact_Session_Schedule',
           CAST(i.Session_ID AS NVARCHAR(50)),
           (SELECT i.Session_Status AS new_status,
                   d.Session_Status AS old_status
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
           ISNULL(CAST(SUBSTRING(CONTEXT_INFO(), 5, 45) AS NVARCHAR(45)), N'0.0.0.0'),
           SYSUTCDATETIME()
    FROM inserted i
    JOIN deleted d ON i.Session_ID = d.Session_ID;
END;
GO

PRINT 'trg_Audit_SessionUpdate rebuilt with ISNULL(CONTEXT_INFO, 1) fallback.';
GO

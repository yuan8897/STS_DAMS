-- =============================================
-- 恢复事件溯源四表的 DENY 写保护
-- 用途：开发过程中表被重建或权限被撤销后，重新应用写保护
-- 执行方式：sqlcmd 或通过 Node.js 脚本
-- =============================================
USE STS_DAMS;
GO

PRINT '正在恢复事件溯源四表的写保护...';
GO

-- 支付交易表：禁止 UPDATE 和 DELETE
DENY UPDATE, DELETE ON Payment_Transaction_Table TO PUBLIC;
GO

-- 库存流水表：禁止 UPDATE 和 DELETE
DENY UPDATE, DELETE ON Inventory_Movement_Ledger TO PUBLIC;
GO

-- 消费记账表：禁止 UPDATE 和 DELETE
DENY UPDATE, DELETE ON Fact_Session_Consumption TO PUBLIC;
GO

-- 系统审计日志表：禁止 UPDATE 和 DELETE
DENY UPDATE, DELETE ON System_Audit_Log_Table TO PUBLIC;
GO

-- 验证权限是否生效
SELECT
    OBJECT_NAME(p.major_id) AS TableName,
    p.permission_name,
    p.state_desc,
    USER_NAME(p.grantee_principal_id) AS Grantee
FROM sys.database_permissions p
WHERE p.class = 1  -- OBJECT_OR_COLUMN
  AND p.state_desc = 'DENY'
  AND p.permission_name IN ('UPDATE', 'DELETE')
  AND OBJECT_NAME(p.major_id) IN (
    'Payment_Transaction_Table',
    'Inventory_Movement_Ledger',
    'Fact_Session_Consumption',
    'System_Audit_Log_Table'
  )
ORDER BY OBJECT_NAME(p.major_id), p.permission_name;
GO

PRINT '写保护恢复完成。';
GO

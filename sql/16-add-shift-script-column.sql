-- =============================================
-- 脚本 16：DM 排班表增加剧本关联字段
-- 功能: 支持店长端排班时关联具体剧本，周视图中展示剧本名称
-- 依赖: Dim_Script_Dictionary (03-module2-script-asset.sql)
-- =============================================

-- 1. 添加 Script_ID 列（可空，关联到剧本字典）
IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('DM_Shift_Availability_Table')
                 AND name = 'Script_ID')
BEGIN
    ALTER TABLE DM_Shift_Availability_Table
    ADD Script_ID INT NULL;

    ALTER TABLE DM_Shift_Availability_Table
    ADD CONSTRAINT FK_Shift_Script
        FOREIGN KEY (Script_ID) REFERENCES Dim_Script_Dictionary(Script_ID);

    PRINT '✓ Added Script_ID column to DM_Shift_Availability_Table';
END
ELSE
    PRINT '→ Script_ID column already exists in DM_Shift_Availability_Table';
GO

-- 2. 添加索引以优化剧本关联排班查询
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DM_Shift_Script')
BEGIN
    CREATE NONCLUSTERED INDEX IX_DM_Shift_Script
        ON DM_Shift_Availability_Table(Script_ID)
        WHERE Script_ID IS NOT NULL;
    PRINT '✓ Added filtered index IX_DM_Shift_Script';
END
ELSE
    PRINT '→ Index IX_DM_Shift_Script already exists';
GO

PRINT 'Script 16 completed.';
GO

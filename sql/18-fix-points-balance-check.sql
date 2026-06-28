-- =============================================
-- 修复 N-DB-5: Points_Balance_After 添加 CHECK >= 0
-- =============================================
-- 问题: Member_Points_Ledger.Points_Balance_After 无 CHECK 约束，
--       可能接受负余额。
-- 参考: User_Member_Profile.Accumulated_Points 已有 CHECK >= 0。
-- 操作: 幂等安全脚本 — 先验证现有数据，再添加约束。
-- =============================================
USE STS_DAMS;
GO

-- Step A: 安全检查 — 确认无负余额记录
-- 必须返回 0 行才继续; 若出现行则须先手动修复数据
DECLARE @negCount INT;
SELECT @negCount = COUNT(*)
FROM Member_Points_Ledger
WHERE Points_Balance_After < 0;

IF @negCount > 0
BEGIN
    PRINT 'ERROR: Found ' + CAST(@negCount AS NVARCHAR) + ' row(s) with Points_Balance_After < 0. Fix data before adding constraint.';
    SELECT Ledger_ID, User_ID, Points_Balance_After, Transaction_Type, Created_At
    FROM Member_Points_Ledger
    WHERE Points_Balance_After < 0;
    RETURN;
END
ELSE
    PRINT 'Step A PASSED: No negative Points_Balance_After values found.';
GO

-- Step B: 添加 CHECK 约束 (幂等)
IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('Member_Points_Ledger')
      AND name = 'CK_Points_Balance_After_NonNegative'
)
BEGIN
    ALTER TABLE Member_Points_Ledger
    ADD CONSTRAINT CK_Points_Balance_After_NonNegative
    CHECK (Points_Balance_After >= 0);
    PRINT 'Step B DONE: CK_Points_Balance_After_NonNegative constraint added.';
END
ELSE
    PRINT 'Step B SKIPPED: Constraint already exists.';
GO

-- 验证
SELECT name, definition
FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID('Member_Points_Ledger')
  AND name = 'CK_Points_Balance_After_NonNegative';
GO

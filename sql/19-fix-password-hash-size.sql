-- =============================================
-- 修复 N-DB-4: Password_Hash VARBINARY(256) → VARBINARY(32)
-- =============================================
-- 问题: SHA-256 输出固定 32 字节，VARBINARY(256) 浪费 8x 存储。
-- 前提: 所有种子数据使用 HASHBYTES('SHA2_256', ...)。
-- 操作: 幂等安全脚本 — 先验证所有值恰好 32 字节，再缩减列类型。
-- =============================================
USE STS_DAMS;
GO

-- Step A: 安全检查 — 确认所有 Password_Hash 值恰好 32 字节
-- 必须返回 count=0 才继续
DECLARE @badLenCount INT;
SELECT @badLenCount = COUNT(*)
FROM Account_Base_Table
WHERE DATALENGTH(Password_Hash) <> 32;

IF @badLenCount > 0
BEGIN
    PRINT 'ERROR: Found ' + CAST(@badLenCount AS NVARCHAR) + ' row(s) with Password_Hash length <> 32 bytes. Fix before altering column.';
    SELECT User_ID, Account_Name, DATALENGTH(Password_Hash) AS hash_byte_length
    FROM Account_Base_Table
    WHERE DATALENGTH(Password_Hash) <> 32;
    RETURN;
END
ELSE
    PRINT 'Step A PASSED: All Password_Hash values are exactly 32 bytes.';
GO

-- Step B: 缩减列类型为 VARBINARY(32)
-- 注意: ALTER COLUMN 对 VARBINARY 缩小是安全的（因为所有现有值 ≤ 32 字节）
DECLARE @currentLen INT;
SELECT @currentLen = max_length
FROM sys.columns
WHERE object_id = OBJECT_ID('Account_Base_Table')
  AND name = 'Password_Hash';

IF @currentLen > 32
BEGIN
    ALTER TABLE Account_Base_Table
    ALTER COLUMN Password_Hash VARBINARY(32) NOT NULL;
    PRINT 'Step B DONE: Password_Hash column reduced to VARBINARY(32).';
END
ELSE
    PRINT 'Step B SKIPPED: Column already VARBINARY(' + CAST(@currentLen AS NVARCHAR) + ').';
GO

-- 验证
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH AS max_bytes
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Account_Base_Table'
  AND COLUMN_NAME = 'Password_Hash';
GO

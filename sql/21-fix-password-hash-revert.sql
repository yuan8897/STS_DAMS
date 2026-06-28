-- =============================================
-- 紧急修复: Password_Hash VARBINARY(32) → VARBINARY(256)
-- =============================================
-- 问题: 19-fix-password-hash-size.sql 将列缩至 VARBINARY(32)，
--       但系统同时使用 SHA-256 (32 bytes 种子) 和 bcrypt (60 bytes 注册/重置)。
--       VARBINARY(32) 导致 bcrypt 哈希被截断，用户无法登录。
--
-- 修复: 恢复为 VARBINARY(256)，兼容两种哈希算法。
-- 幂等: 已为 VARBINARY(256) 则跳过。
-- =============================================
USE STS_DAMS;
GO

DECLARE @currentLen INT;
SELECT @currentLen = max_length
FROM sys.columns
WHERE object_id = OBJECT_ID('Account_Base_Table')
  AND name = 'Password_Hash';

IF @currentLen < 256
BEGIN
    ALTER TABLE Account_Base_Table
    ALTER COLUMN Password_Hash VARBINARY(256) NOT NULL;
    PRINT 'Password_Hash column widened to VARBINARY(256).';
END
ELSE
    PRINT 'Password_Hash column already VARBINARY(256), skipped.';
GO

-- 验证
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH AS max_bytes
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Account_Base_Table'
  AND COLUMN_NAME = 'Password_Hash';
GO

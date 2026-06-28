-- =============================================
-- 紧急修复: 重设所有账户密码哈希（per-user salt）
-- =============================================
-- 用途: 修正因 VARBINARY(32) 截断或 store_mgr 缺少 salt
--       导致的密码验证失败。重设所有活跃账户密码为 123456。
--
-- 用法: sqlcmd -S localhost -d STS_DAMS -i 22-fix-all-passwords.sql
-- 幂等: 始终执行（UPDATE 幂等）
-- ⚠️  生产环境: 执行后立即运行 reset-passwords.js --random
-- =============================================
USE STS_DAMS;
GO

PRINT '=== 重设所有活跃账户密码为 123456 (SHA-256 + per-user salt) ===';
GO

UPDATE Account_Base_Table
SET Password_Hash = HASHBYTES('SHA2_256', CONCAT(Account_Name, ':', '123456'))
WHERE Is_Deleted = 0;

DECLARE @updated INT = @@ROWCOUNT;
PRINT '已更新 ' + CAST(@updated AS NVARCHAR) + ' 个账户的密码哈希。';
PRINT '';
PRINT '所有密码已重置为: 123456';
PRINT '测试登录: admin / 123456';
PRINT '测试登录: store_mgr / 123456';
PRINT '';
PRINT '⚠️  生产环境务必运行: cd sts-dams-backend && node scripts/reset-passwords.js --random';
GO

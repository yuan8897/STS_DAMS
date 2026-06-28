-- =============================================
-- 脚本 17：优惠券增加4位数字验证码
-- 功能: 为 User_Coupon_Instance 添加 Verification_Code 列
--       生成已有优惠券的随机验证码
--       玩家端出示验证码，DM端核销使用
-- =============================================
USE STS_DAMS;
GO

-- 1. 添加 Verification_Code 列（CHAR(4)，可空，带唯一约束）
IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('User_Coupon_Instance')
                 AND name = 'Verification_Code')
BEGIN
    ALTER TABLE User_Coupon_Instance
    ADD Verification_Code CHAR(4) NULL;

    -- 添加唯一约束（验证码不可重复）
    ALTER TABLE User_Coupon_Instance
    ADD CONSTRAINT UQ_Coupon_Verification_Code UNIQUE (Verification_Code);

    PRINT '✓ Added Verification_Code column to User_Coupon_Instance';
END
ELSE
    PRINT '→ Verification_Code column already exists';
GO

-- 2. 为已有未使用和已使用的优惠券生成随机验证码
DECLARE @coupons TABLE (Coupon_ID BIGINT, Verification_Code CHAR(4));

-- 生成不重复的4位数字验证码（1000-9999）
;WITH digits AS (
    SELECT 1000 + ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS code_num
    FROM sys.all_columns a CROSS JOIN sys.all_columns b
    WHERE ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) <= 9000
)
UPDATE c
SET Verification_Code = RIGHT('0000' + CAST(d.code_num AS NVARCHAR), 4)
OUTPUT INSERTED.Coupon_ID, INSERTED.Verification_Code INTO @coupons
FROM User_Coupon_Instance c
INNER JOIN (
    SELECT Coupon_ID, ROW_NUMBER() OVER (ORDER BY Coupon_ID) AS rn
    FROM User_Coupon_Instance
    WHERE Verification_Code IS NULL
) ranked ON c.Coupon_ID = ranked.Coupon_ID
INNER JOIN (
    SELECT code_num, ROW_NUMBER() OVER (ORDER BY code_num) AS rn
    FROM digits
) d ON ranked.rn = d.rn
WHERE c.Verification_Code IS NULL;

PRINT '✓ Generated verification codes for ' + CAST(@@ROWCOUNT AS NVARCHAR) + ' existing coupons';
GO

-- 3. 添加 NOT NULL 约束（所有优惠券都必须有验证码）
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('User_Coupon_Instance')
             AND name = 'Verification_Code'
             AND is_nullable = 1)
BEGIN
    ALTER TABLE User_Coupon_Instance
    ALTER COLUMN Verification_Code CHAR(4) NOT NULL;
    PRINT '✓ Verification_Code set to NOT NULL';
END
GO

-- 4. 添加索引以加速验证码查询
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Coupon_Verification_Code')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Coupon_Verification_Code
        ON User_Coupon_Instance(Verification_Code)
        INCLUDE (Coupon_Status, Expires_At, Template_ID);
    PRINT '✓ Added index IX_Coupon_Verification_Code';
END
GO

PRINT 'Script 17 completed.';
GO

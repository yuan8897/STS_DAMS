-- =============================================
-- 图片字段补充：剧本封面 + DM 头像
-- 执行时机：在已有数据库上补充图片字段
-- 使用 IF NOT EXISTS (sys.columns) 保证幂等
-- =============================================
USE STS_DAMS;
GO

PRINT '正在添加图片字段...';
GO

-- Dim_Script_Dictionary 添加 Cover_Image_URL
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('Dim_Script_Dictionary')
      AND name = 'Cover_Image_URL'
)
BEGIN
    ALTER TABLE Dim_Script_Dictionary
    ADD Cover_Image_URL NVARCHAR(500) NULL;
    PRINT '  ✓ Dim_Script_Dictionary.Cover_Image_URL 已添加';
END
ELSE
    PRINT '  → Dim_Script_Dictionary.Cover_Image_URL 已存在，跳过';
GO

-- DM_Profile_Table 添加 Avatar_Image_URL
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('DM_Profile_Table')
      AND name = 'Avatar_Image_URL'
)
BEGIN
    ALTER TABLE DM_Profile_Table
    ADD Avatar_Image_URL NVARCHAR(500) NULL;
    PRINT '  ✓ DM_Profile_Table.Avatar_Image_URL 已添加';
END
ELSE
    PRINT '  → DM_Profile_Table.Avatar_Image_URL 已存在，跳过';
GO

PRINT '图片字段补充完成。';
GO

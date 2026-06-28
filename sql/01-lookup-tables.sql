-- =============================================
-- 查找表（基础设施）
-- =============================================
USE STS_DAMS;
GO

-- 2.2.1 Dim_Role_Lookup（角色查找表）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Dim_Role_Lookup')
CREATE TABLE Dim_Role_Lookup (
    Role_ID   TINYINT       IDENTITY(1,1) PRIMARY KEY,
    Role_Name NVARCHAR(30)  NOT NULL UNIQUE
);
GO

-- 2.2.2 Dim_Genre_Lookup（题材查找表）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Dim_Genre_Lookup')
CREATE TABLE Dim_Genre_Lookup (
    Genre_ID   TINYINT       IDENTITY(1,1) PRIMARY KEY,
    Genre_Name NVARCHAR(30)  NOT NULL UNIQUE
);
GO

-- 初始数据
IF NOT EXISTS (SELECT 1 FROM Dim_Role_Lookup)
INSERT INTO Dim_Role_Lookup (Role_Name) VALUES ('Player'), ('DM'), ('Admin');

IF NOT EXISTS (SELECT 1 FROM Dim_Genre_Lookup)
INSERT INTO Dim_Genre_Lookup (Genre_Name) VALUES
    ('恐怖'), ('情感'), ('硬核推理'), ('欢乐'), ('机制'),
    ('古风'), ('日式'), ('民国'), ('欧式'), ('科幻');

PRINT 'Lookup tables created and seeded.';
GO

-- =============================================
-- 模块二：剧本与门店资产（4张表）
-- =============================================
USE STS_DAMS;
GO

-- 2.4.1 Dim_Script_Dictionary（剧本内容字典表）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Dim_Script_Dictionary')
CREATE TABLE Dim_Script_Dictionary (
    Script_ID              INT              IDENTITY(1,1) PRIMARY KEY,
    Script_Title           NVARCHAR(100)    NOT NULL UNIQUE,
    Min_Required_Players   INT              NOT NULL CHECK (Min_Required_Players >= 2),
    Max_Allowed_Players    INT              NOT NULL,
    Estimated_Duration     INT              NOT NULL CHECK (Estimated_Duration > 0),
    Base_Price             DECIMAL(10,2)    NOT NULL CHECK (Base_Price >= 0),
    Primary_Genre          TINYINT          NOT NULL REFERENCES Dim_Genre_Lookup(Genre_ID),
    Is_Retired             BIT              NOT NULL DEFAULT 0,
    CONSTRAINT CK_Player_Range CHECK (Max_Allowed_Players >= Min_Required_Players)
);
GO

-- 2.4.2 Script_Role_Definition_Table（剧本角色定义表）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Script_Role_Definition_Table')
CREATE TABLE Script_Role_Definition_Table (
    Role_ID             INT              IDENTITY(1,1) PRIMARY KEY,
    Script_ID           INT              NOT NULL REFERENCES Dim_Script_Dictionary(Script_ID),
    Role_Name           NVARCHAR(50)     NOT NULL,
    Gender_Restriction  NVARCHAR(10)     NOT NULL CHECK (Gender_Restriction IN ('Male','Female','Any')),
    Role_Description    NVARCHAR(500)    NULL,
    CONSTRAINT UQ_Script_Role UNIQUE (Script_ID, Role_Name)
);
GO

-- 2.4.3 Asset_Script_Copy_Table（剧本实体副本资产表）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Asset_Script_Copy_Table')
CREATE TABLE Asset_Script_Copy_Table (
    Copy_ID                     BIGINT           IDENTITY(1,1) PRIMARY KEY,
    Copy_Asset_Barcode          NVARCHAR(50)     NOT NULL UNIQUE,
    Script_ID                   INT              NOT NULL REFERENCES Dim_Script_Dictionary(Script_ID),
    Authorization_Type          NVARCHAR(30)     NOT NULL CHECK (Authorization_Type IN ('Boxed','Exclusive','One_Of_A_Kind')),
    Asset_Condition             NVARCHAR(20)     NOT NULL CHECK (Asset_Condition IN ('Perfect','Worn','In_Maintenance','Scrapped')),
    Purchase_Date               DATE             NOT NULL,
    Current_Storage_Location    NVARCHAR(100)    NULL
);
GO

-- 2.4.4 Dim_Store_Room（门店物理房间表）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Dim_Store_Room')
CREATE TABLE Dim_Store_Room (
    Room_ID                 INT              IDENTITY(1,1) PRIMARY KEY,
    Room_Name               NVARCHAR(50)     NOT NULL UNIQUE,
    Room_Max_Capacity       INT              NOT NULL CHECK (Room_Max_Capacity >= 3),
    Room_Theme              NVARCHAR(50)     NULL,
    Room_Operating_Status   NVARCHAR(20)     NOT NULL CHECK (Room_Operating_Status IN ('Operational','Under_Maintenance'))
);
GO

PRINT 'Module 2 tables created.';
GO

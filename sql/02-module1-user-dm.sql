-- =============================================
-- 模块一：用户与人员资质（4张表）
-- =============================================
USE STS_DAMS;
GO

-- 2.3.1 Account_Base_Table（用户核心账户表）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Account_Base_Table')
CREATE TABLE Account_Base_Table (
    User_ID             INT              IDENTITY(1,1) PRIMARY KEY,
    Account_Name        NVARCHAR(50)     NOT NULL UNIQUE,
    Password_Hash       VARBINARY(256)   NOT NULL,  -- SHA-256 (32 bytes 种子) / bcrypt (60 bytes 注册) 双模式; 回退见 sql/21-fix-password-hash-revert.sql
    Contact_Phone       NVARCHAR(20)     NULL,
    Role_Type           TINYINT          NOT NULL REFERENCES Dim_Role_Lookup(Role_ID),
    Account_Status      NVARCHAR(20)     NOT NULL CHECK (Account_Status IN ('Active','Locked','Disabled')),
    Account_Created_At  DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    Last_Login_At       DATETIME2(3)     NULL,
    Is_Deleted          BIT              NOT NULL DEFAULT 0,
    Deleted_At          DATETIME2(3)     NULL,
    Row_Version         ROWVERSION
);
GO

-- 2.3.2 DM_Profile_Table（DM 资质明细表）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DM_Profile_Table')
CREATE TABLE DM_Profile_Table (
    DM_User_ID              INT              PRIMARY KEY REFERENCES Account_Base_Table(User_ID),
    DM_Stage_Name           NVARCHAR(50)     NOT NULL UNIQUE,
    Base_Per_Session_Wage   DECIMAL(10,2)    NOT NULL CHECK (Base_Per_Session_Wage >= 0),
    Employment_Status       NVARCHAR(20)     NOT NULL CHECK (Employment_Status IN ('Probation','Active','On_Leave','Terminated')),
    Hire_Date               DATE             NOT NULL
);
GO

-- 2.3.3 DM_Script_Capability_Table（DM 剧本带场能力表）
-- 依赖: DM_Profile_Table, Dim_Script_Dictionary
-- 注意: Script_ID 外键将在模块二表创建后补充

-- 2.3.4 DM_Shift_Availability_Table（DM 排班可用时段表）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DM_Shift_Availability_Table')
CREATE TABLE DM_Shift_Availability_Table (
    Shift_ID        BIGINT           IDENTITY(1,1) PRIMARY KEY,
    DM_User_ID      INT              NOT NULL REFERENCES DM_Profile_Table(DM_User_ID),
    Available_Start DATETIME2(3)     NOT NULL,
    Available_End   DATETIME2(3)     NOT NULL,
    Shift_Type      NVARCHAR(20)     NOT NULL CHECK (Shift_Type IN ('Regular','Overtime','On_Call')),
    Created_At      DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Shift_TimeRange CHECK (Available_End > Available_Start)
);
GO

PRINT 'Module 1 tables created.';
GO

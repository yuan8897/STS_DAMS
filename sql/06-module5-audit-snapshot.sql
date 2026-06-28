-- =============================================
-- 模块五：系统审计 + DM能力表 + 快照表
-- =============================================
USE STS_DAMS;
GO

-- 2.3.3 DM_Script_Capability_Table（DM 剧本带场能力表）
-- 放在此处因为依赖 Dim_Script_Dictionary 和 DM_Profile_Table 均已创建
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DM_Script_Capability_Table')
CREATE TABLE DM_Script_Capability_Table (
    Capability_ID      BIGINT           IDENTITY(1,1) PRIMARY KEY,
    DM_User_ID         INT              NOT NULL REFERENCES DM_Profile_Table(DM_User_ID),
    Script_ID          INT              NOT NULL REFERENCES Dim_Script_Dictionary(Script_ID),
    Proficiency_Level  NVARCHAR(20)     NOT NULL CHECK (Proficiency_Level IN ('Trained','Proficient','Expert')),
    Certified_At       DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_DM_Script UNIQUE (DM_User_ID, Script_ID)
);
GO

-- 2.7 System_Audit_Log_Table（系统操作审计日志表）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'System_Audit_Log_Table')
CREATE TABLE System_Audit_Log_Table (
    Audit_ID            BIGINT           IDENTITY(1,1) PRIMARY KEY,
    Store_ID            INT              NOT NULL DEFAULT 1,
    Operator_User_ID    INT              NOT NULL REFERENCES Account_Base_Table(User_ID),
    Action_Type         NVARCHAR(50)     NOT NULL,
    Target_Entity       NVARCHAR(50)     NOT NULL,
    Target_Record_ID    NVARCHAR(50)     NOT NULL,
    Action_Details      NVARCHAR(MAX)    NULL,
    Client_IP           VARCHAR(45)      NULL,
    Logged_At           DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- 2.12.1 Daily_KPI_Snapshot（每日经营快照表）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Daily_KPI_Snapshot')
CREATE TABLE Daily_KPI_Snapshot (
    Snapshot_ID              BIGINT           IDENTITY(1,1) PRIMARY KEY,
    Store_ID                 INT              NOT NULL DEFAULT 1,
    Snapshot_Date            DATE             NOT NULL,
    Total_Sessions           INT              NOT NULL DEFAULT 0,
    Completed_Sessions       INT              NOT NULL DEFAULT 0,
    Aborted_Sessions         INT              NOT NULL DEFAULT 0,
    Total_Revenue_Script     DECIMAL(15,2)    NOT NULL DEFAULT 0,
    Total_Revenue_Consumption DECIMAL(15,2)   NOT NULL DEFAULT 0,
    Total_Refund             DECIMAL(15,2)    NOT NULL DEFAULT 0,
    Active_Players           INT              NOT NULL DEFAULT 0,
    New_Registrations        INT              NOT NULL DEFAULT 0,
    Created_At               DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_Daily_KPI_Date UNIQUE (Store_ID, Snapshot_Date)
);
GO

-- 2.12.2 Daily_User_LTV_Snapshot（用户 LTV 快照表）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Daily_User_LTV_Snapshot')
CREATE TABLE Daily_User_LTV_Snapshot (
    Snapshot_ID                BIGINT           IDENTITY(1,1) PRIMARY KEY,
    User_ID                   INT              NOT NULL REFERENCES Account_Base_Table(User_ID),
    Snapshot_Date             DATE             NOT NULL,
    Lifetime_Days             INT              NOT NULL DEFAULT 0,
    Total_Sessions_Attended   INT              NOT NULL DEFAULT 0,
    Total_Spent_Script        DECIMAL(15,2)    NOT NULL DEFAULT 0,
    Total_Spent_Consumption   DECIMAL(15,2)    NOT NULL DEFAULT 0,
    Avg_Per_Session_Spend     DECIMAL(10,2)    NOT NULL DEFAULT 0,
    Days_Since_Last_Session   INT              NULL,
    CONSTRAINT UQ_User_LTV_Date UNIQUE (User_ID, Snapshot_Date)
);
GO

PRINT 'Module 5 + capability + snapshot tables created.';
GO

-- =============================================
-- 模块六~九：会员积分、优惠券、服务评价、消息通知
-- 这些表在后端路由中被引用但数据库中不存在
-- =============================================
USE STS_DAMS;
GO

-- =============================================
-- 模块六：会员积分（3张表）
-- =============================================

-- 2.6.1 Dim_Member_Level（会员等级查找表）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Dim_Member_Level')
CREATE TABLE Dim_Member_Level (
    Level_ID                 TINYINT        IDENTITY(1,1) PRIMARY KEY,
    Level_Name               NVARCHAR(30)   NOT NULL UNIQUE,
    Min_Required_Points      INT            NOT NULL CHECK (Min_Required_Points >= 0),
    Discount_Rate            DECIMAL(4,3)   NOT NULL CHECK (Discount_Rate > 0 AND Discount_Rate <= 1),
    Point_Earning_Multiplier DECIMAL(3,2)   NOT NULL DEFAULT 1.00 CHECK (Point_Earning_Multiplier >= 1.00)
);
GO

-- 2.6.2 User_Member_Profile（用户会员档案表）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'User_Member_Profile')
CREATE TABLE User_Member_Profile (
    User_ID                  INT            PRIMARY KEY REFERENCES Account_Base_Table(User_ID),
    Accumulated_Points       INT            NOT NULL DEFAULT 0 CHECK (Accumulated_Points >= 0),
    Current_Level_ID         TINYINT        NOT NULL DEFAULT 1 REFERENCES Dim_Member_Level(Level_ID),
    Total_Lifetime_Points    INT            NOT NULL DEFAULT 0 CHECK (Total_Lifetime_Points >= 0),
    Level_Upgraded_At        DATETIME2(3)   NULL
);
GO

-- 2.6.3 Member_Points_Ledger（积分流水台账表）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Member_Points_Ledger')
CREATE TABLE Member_Points_Ledger (
    Ledger_ID                BIGINT         IDENTITY(1,1) PRIMARY KEY,
    User_ID                  INT            NOT NULL REFERENCES Account_Base_Table(User_ID),
    Points_Delta             INT            NOT NULL CHECK (Points_Delta <> 0),
    Transaction_Type         NVARCHAR(30)   NOT NULL CHECK (Transaction_Type IN (
                                  'Earn_Session','Earn_Consumption','Earn_Manual',
                                  'Redeem_Cash','Redeem_Gift','Expire','Adjust')),
    Related_Session_ID       BIGINT         NULL REFERENCES Fact_Session_Schedule(Session_ID),
    Related_Registration_ID  BIGINT         NULL REFERENCES Bridge_Player_Registration(Registration_ID),
    Points_Balance_After     INT            NOT NULL,
    Operator_User_ID         INT            NOT NULL REFERENCES Account_Base_Table(User_ID),
    Remarks                  NVARCHAR(200)  NULL,
    Created_At               DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

PRINT 'Module 6 (Membership) tables created.';
GO

-- =============================================
-- 模块七：优惠券（3张表）
-- =============================================

-- 2.7.1 Coupon_Template（优惠券模板表）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Coupon_Template')
CREATE TABLE Coupon_Template (
    Template_ID              INT            IDENTITY(1,1) PRIMARY KEY,
    Coupon_Name              NVARCHAR(100)  NOT NULL,
    Discount_Type            NVARCHAR(20)   NOT NULL CHECK (Discount_Type IN ('Fixed_Amount','Percent_Off')),
    Discount_Value           DECIMAL(10,2)  NOT NULL CHECK (Discount_Value > 0),
    Min_Order_Amount         DECIMAL(10,2)  NOT NULL DEFAULT 0 CHECK (Min_Order_Amount >= 0),
    Max_Discount_Cap         DECIMAL(10,2)  NULL CHECK (Max_Discount_Cap IS NULL OR Max_Discount_Cap > 0),
    Valid_Days_From_Issue    INT            NOT NULL CHECK (Valid_Days_From_Issue > 0),
    Applicable_Script_ID     INT            NULL REFERENCES Dim_Script_Dictionary(Script_ID),
    Total_Issuance_Limit     INT            NULL CHECK (Total_Issuance_Limit IS NULL OR Total_Issuance_Limit > 0),
    Per_User_Limit           INT            NOT NULL DEFAULT 1 CHECK (Per_User_Limit > 0),
    Is_Active                BIT            NOT NULL DEFAULT 1,
    Created_By_User_ID       INT            NOT NULL REFERENCES Account_Base_Table(User_ID),
    Created_At               DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- 2.7.2 User_Coupon_Instance（用户优惠券实例表）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'User_Coupon_Instance')
CREATE TABLE User_Coupon_Instance (
    Coupon_ID                BIGINT         IDENTITY(1,1) PRIMARY KEY,
    Template_ID              INT            NOT NULL REFERENCES Coupon_Template(Template_ID),
    User_ID                  INT            NOT NULL REFERENCES Account_Base_Table(User_ID),
    Coupon_Status            NVARCHAR(20)   NOT NULL CHECK (Coupon_Status IN ('Unused','Used','Expired','Revoked')),
    Issued_At                DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME(),
    Expires_At               DATETIME2(3)   NOT NULL,
    Used_At                  DATETIME2(3)   NULL,
    Issued_By_User_ID        INT            NOT NULL REFERENCES Account_Base_Table(User_ID)
);
GO

-- 2.7.3 Discount_Usage_Log（优惠券核销记录表）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Discount_Usage_Log')
CREATE TABLE Discount_Usage_Log (
    Usage_ID                 BIGINT         IDENTITY(1,1) PRIMARY KEY,
    Coupon_ID                BIGINT         NOT NULL REFERENCES User_Coupon_Instance(Coupon_ID),
    Transaction_ID           BIGINT         NOT NULL REFERENCES Payment_Transaction_Table(Transaction_ID),
    Discount_Amount          DECIMAL(10,2)  NOT NULL CHECK (Discount_Amount >= 0),
    Recorded_At              DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

PRINT 'Module 7 (Coupons) tables created.';
GO

-- =============================================
-- 模块八：服务评价（1张表）
-- =============================================

-- 2.8.1 Fact_Session_Review（场次服务评价表）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Fact_Session_Review')
CREATE TABLE Fact_Session_Review (
    Review_ID                BIGINT         IDENTITY(1,1) PRIMARY KEY,
    Session_ID               BIGINT         NOT NULL REFERENCES Fact_Session_Schedule(Session_ID),
    Reviewer_User_ID         INT            NOT NULL REFERENCES Account_Base_Table(User_ID),
    Registration_ID          BIGINT         NOT NULL REFERENCES Bridge_Player_Registration(Registration_ID),
    DM_Rating                TINYINT        NOT NULL CHECK (DM_Rating BETWEEN 1 AND 5),
    Script_Rating            TINYINT        NOT NULL CHECK (Script_Rating BETWEEN 1 AND 5),
    Room_Rating              TINYINT        NOT NULL CHECK (Room_Rating BETWEEN 1 AND 5),
    Overall_Rating           TINYINT        NOT NULL CHECK (Overall_Rating BETWEEN 1 AND 5),
    Review_Comment           NVARCHAR(500)  NULL,
    Tags                     NVARCHAR(200)  NULL,
    Is_Anonymous             BIT            NOT NULL DEFAULT 0,
    Created_At               DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_One_Review_Per_Session UNIQUE (Session_ID, Reviewer_User_ID)
);
GO

PRINT 'Module 8 (Reviews) table created.';
GO

-- =============================================
-- 模块九：消息通知（1张表）
-- =============================================

-- 2.9.1 User_Notification（用户通知表）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'User_Notification')
CREATE TABLE User_Notification (
    Notification_ID          BIGINT         IDENTITY(1,1) PRIMARY KEY,
    Recipient_User_ID        INT            NOT NULL REFERENCES Account_Base_Table(User_ID),
    Notification_Type        NVARCHAR(30)   NOT NULL CHECK (Notification_Type IN (
                                  'Session_Reminder','Payment_Confirm','Coupon_Issued',
                                  'Coupon_Expiring','System_Announce','Low_Stock_Alert','Review_Request')),
    Title                    NVARCHAR(200)  NOT NULL,
    Content                  NVARCHAR(MAX)  NULL,
    Related_Entity_Type      NVARCHAR(50)   NULL,
    Related_Entity_ID        NVARCHAR(50)   NULL,
    Is_Read                  BIT            NOT NULL DEFAULT 0,
    Read_At                  DATETIME2(3)   NULL,
    Is_Pushed                BIT            NOT NULL DEFAULT 0,
    Created_At               DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

PRINT 'Module 9 (Notifications) table created.';
GO

-- =============================================
-- 门店信息表（Admin Settings 门店配置）
-- =============================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Dim_Store_Info')
CREATE TABLE Dim_Store_Info (
    Store_ID         INT            PRIMARY KEY DEFAULT 1,
    Store_Name       NVARCHAR(100)  NOT NULL,
    Store_Address    NVARCHAR(200)  NULL,
    Contact_Phone    NVARCHAR(30)   NULL,
    Contact_Email    NVARCHAR(100)  NULL,
    Business_Hours   NVARCHAR(200)  NULL,
    Created_At       DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME(),
    Updated_At       DATETIME2(3)   NULL
);
GO

PRINT 'Dim_Store_Info table created.';
GO

-- =============================================
-- 索引视图：DM 评价统计
-- =============================================

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

DROP VIEW IF EXISTS dbo.vw_DM_Review_Stats;
GO

CREATE VIEW dbo.vw_DM_Review_Stats WITH SCHEMABINDING AS
SELECT
    s.DM_User_ID,
    COUNT_BIG(*) AS Total_Reviews,
    AVG(CAST(r.Overall_Rating AS DECIMAL(3,1))) AS Avg_Overall_Rating,
    AVG(CAST(r.DM_Rating AS DECIMAL(3,1))) AS Avg_DM_Rating
FROM dbo.Fact_Session_Review r
JOIN dbo.Fact_Session_Schedule s ON s.Session_ID = r.Session_ID
GROUP BY s.DM_User_ID;
GO

-- 为索引视图创建唯一聚簇索引
CREATE UNIQUE CLUSTERED INDEX IX_vw_DM_Review_Stats
    ON dbo.vw_DM_Review_Stats(DM_User_ID);
GO

PRINT 'Indexed view vw_DM_Review_Stats created.';
GO

-- =============================================
-- 扩展模块索引
-- =============================================

-- 积分流水按用户查询索引
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PointsLedger_UserId')
    CREATE NONCLUSTERED INDEX IX_PointsLedger_UserId
        ON Member_Points_Ledger(User_ID, Created_At DESC);

-- 优惠券按用户+状态查询索引
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CouponInstance_UserStatus')
    CREATE NONCLUSTERED INDEX IX_CouponInstance_UserStatus
        ON User_Coupon_Instance(User_ID, Coupon_Status)
        INCLUDE (Template_ID, Expires_At);

-- 评价按场次查询索引
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Review_Session')
    CREATE NONCLUSTERED INDEX IX_Review_Session
        ON Fact_Session_Review(Session_ID);

-- 通知按接收用户+已读状态查询索引
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Notification_Recipient')
    CREATE NONCLUSTERED INDEX IX_Notification_Recipient
        ON User_Notification(Recipient_User_ID, Is_Read)
        INCLUDE (Notification_Type, Title, Created_At);

-- 通知清理索引
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Notification_Cleanup')
    CREATE NONCLUSTERED INDEX IX_Notification_Cleanup
        ON User_Notification(Is_Read, Read_At)
        WHERE Is_Read = 1;

PRINT 'All expansion module indexes created.';
GO

PRINT '========================================';
PRINT '  Modules 6-9 expansion complete.';
PRINT '  9 tables + 1 indexed view created.';
PRINT '========================================';
GO

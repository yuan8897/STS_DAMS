-- =============================================
-- 模块三：时空调度与订单（3张表）
-- 依赖: 模块一 (DM_Profile_Table, Account_Base_Table)
--       模块二 (Asset_Script_Copy_Table, Dim_Store_Room, Script_Role_Definition_Table)
-- =============================================
USE STS_DAMS;
GO

-- 2.5.1 Fact_Session_Schedule（时空调度场次主表）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Fact_Session_Schedule')
CREATE TABLE Fact_Session_Schedule (
    Session_ID               BIGINT           IDENTITY(1,1) PRIMARY KEY,
    Store_ID                 INT              NOT NULL DEFAULT 1,
    Copy_ID                  BIGINT           NOT NULL REFERENCES Asset_Script_Copy_Table(Copy_ID),
    Room_ID                  INT              NOT NULL REFERENCES Dim_Store_Room(Room_ID),
    DM_User_ID               INT              NOT NULL REFERENCES DM_Profile_Table(DM_User_ID),
    Scheduled_Start_Time     DATETIME2(3)     NOT NULL,
    Scheduled_End_Time       DATETIME2(3)     NOT NULL,
    Session_Status           NVARCHAR(20)     NOT NULL CHECK (Session_Status IN ('Matching','Locked_Ready','In_Progress','Completed','Aborted')),
    Frozen_Per_Head_Price    DECIMAL(10,2)    NOT NULL,
    Created_By_User_ID       INT              NOT NULL REFERENCES Account_Base_Table(User_ID),
    Created_At               DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    Row_Version              ROWVERSION,
    CONSTRAINT CK_Session_TimeRange CHECK (Scheduled_End_Time > Scheduled_Start_Time)
);
GO

-- 2.5.2 Bridge_Player_Registration（玩家参团登记表）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Bridge_Player_Registration')
CREATE TABLE Bridge_Player_Registration (
    Registration_ID          BIGINT           IDENTITY(1,1) PRIMARY KEY,
    Session_ID               BIGINT           NOT NULL REFERENCES Fact_Session_Schedule(Session_ID),
    Player_User_ID           INT              NOT NULL REFERENCES Account_Base_Table(User_ID),
    Role_ID                  INT              NULL REFERENCES Script_Role_Definition_Table(Role_ID),
    Joined_At                DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    Cached_Payment_Status    NVARCHAR(20)     NOT NULL CHECK (Cached_Payment_Status IN ('Unpaid','Deposit_Paid','Fully_Paid','Refunded')),
    CONSTRAINT UQ_Player_Session UNIQUE (Session_ID, Player_User_ID)
);
GO

-- 2.5.3 Payment_Transaction_Table（支付流水交易表）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Payment_Transaction_Table')
CREATE TABLE Payment_Transaction_Table (
    Transaction_ID           BIGINT           IDENTITY(1,1) PRIMARY KEY,
    Store_ID                 INT              NOT NULL DEFAULT 1,
    Registration_ID          BIGINT           NOT NULL REFERENCES Bridge_Player_Registration(Registration_ID),
    Transaction_Type         NVARCHAR(20)     NOT NULL CHECK (Transaction_Type IN ('Deposit','Final_Payment','Refund','Adjustment')),
    Amount                   DECIMAL(10,2)    NOT NULL,
    Payment_Method           NVARCHAR(30)     NOT NULL CHECK (Payment_Method IN ('WeChat','Alipay','Cash','Bank_Card','Member_Balance')),
    External_Reference_No    NVARCHAR(100)    NULL,
    Processed_At             DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    Operator_User_ID         INT              NOT NULL REFERENCES Account_Base_Table(User_ID),
    Remarks                  NVARCHAR(200)    NULL,
    CONSTRAINT CK_Transaction_Amount CHECK (
        (Transaction_Type = 'Refund' AND Amount < 0) OR
        (Transaction_Type IN ('Deposit','Final_Payment') AND Amount > 0) OR
        (Transaction_Type = 'Adjustment')
    )
);
GO

PRINT 'Module 3 tables created.';
GO

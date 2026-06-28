-- =============================================
-- 模块四：库存与消费记账（3张表）
-- 依赖: 模块三 (Fact_Session_Schedule)
-- =============================================
USE STS_DAMS;
GO

-- 2.6.1 Dim_Inventory_Item（门店物资商品库存主表）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Dim_Inventory_Item')
CREATE TABLE Dim_Inventory_Item (
    Item_ID                  INT              IDENTITY(1,1) PRIMARY KEY,
    Item_Name                NVARCHAR(100)    NOT NULL UNIQUE,
    Current_Stock_Cache      INT              NOT NULL CHECK (Current_Stock_Cache >= 0),
    Cost_Unit_Price          DECIMAL(10,2)    NOT NULL CHECK (Cost_Unit_Price >= 0),
    Selling_Unit_Price       DECIMAL(10,2)    NOT NULL,
    Item_Category            NVARCHAR(30)     NOT NULL,
    Safety_Alert_Threshold   INT              NOT NULL DEFAULT 10,
    Is_Delisted              BIT              NOT NULL DEFAULT 0,
    CONSTRAINT CK_Profit_Margin CHECK (Selling_Unit_Price >= Cost_Unit_Price)
);
GO

-- 2.6.2 Inventory_Movement_Ledger（物资库存流水台账表）
-- 注意: Related_Consumption_ID 外键先留 NULL 或等 Fact_Session_Consumption 创建后再 ALTER
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Inventory_Movement_Ledger')
CREATE TABLE Inventory_Movement_Ledger (
    Movement_ID              BIGINT           IDENTITY(1,1) PRIMARY KEY,
    Store_ID                 INT              NOT NULL DEFAULT 1,
    Item_ID                  INT              NOT NULL REFERENCES Dim_Inventory_Item(Item_ID),
    Quantity_Delta           INT              NOT NULL CHECK (Quantity_Delta <> 0),
    Movement_Type            NVARCHAR(30)     NOT NULL CHECK (Movement_Type IN ('Purchase_In','Sale_Out','Damage_Loss','Inventory_Adjust','Initial_Stock')),
    Related_Session_ID       BIGINT           NULL REFERENCES Fact_Session_Schedule(Session_ID),
    Related_Consumption_ID   BIGINT           NULL, -- 外键将在 Fact_Session_Consumption 创建后添加
    Operator_User_ID         INT              NOT NULL REFERENCES Account_Base_Table(User_ID),
    Movement_Reason          NVARCHAR(200)    NULL,
    Movement_At              DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- 2.6.3 Fact_Session_Consumption（场次附加消费流水表）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Fact_Session_Consumption')
CREATE TABLE Fact_Session_Consumption (
    Consumption_ID           BIGINT           IDENTITY(1,1) PRIMARY KEY,
    Store_ID                 INT              NOT NULL DEFAULT 1,
    Session_ID               BIGINT           NOT NULL REFERENCES Fact_Session_Schedule(Session_ID),
    Item_ID                  INT              NOT NULL REFERENCES Dim_Inventory_Item(Item_ID),
    Consumed_Quantity        INT              NOT NULL CHECK (Consumed_Quantity > 0),
    Unit_Price_At_Sale       DECIMAL(10,2)    NOT NULL,
    Line_Total_Cost          DECIMAL(10,2)    NOT NULL,
    Recording_DM_User_ID     INT              NOT NULL REFERENCES Account_Base_Table(User_ID),
    Recorded_At              DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- 补充 Inventory_Movement_Ledger 的 Related_Consumption_ID 外键
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Inventory_Ledger_Consumption')
    ALTER TABLE Inventory_Movement_Ledger DROP CONSTRAINT FK_Inventory_Ledger_Consumption;
GO
ALTER TABLE Inventory_Movement_Ledger
    ADD CONSTRAINT FK_Inventory_Ledger_Consumption
    FOREIGN KEY (Related_Consumption_ID) REFERENCES Fact_Session_Consumption(Consumption_ID);
GO

PRINT 'Module 4 tables created.';
GO

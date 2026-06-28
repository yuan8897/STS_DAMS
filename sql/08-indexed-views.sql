SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE STS_DAMS;
GO

-- =============================================
-- 索引视图定义（2.10 节）
-- =============================================

-- 场次实时参团人数视图
DROP VIEW IF EXISTS dbo.vw_Session_Player_Count;
GO

CREATE VIEW dbo.vw_Session_Player_Count WITH SCHEMABINDING AS
SELECT Session_ID, COUNT_BIG(*) AS Registered_Count
FROM dbo.Bridge_Player_Registration
GROUP BY Session_ID;
GO

-- 为索引视图创建唯一聚簇索引
CREATE UNIQUE CLUSTERED INDEX IX_vw_Session_Count
    ON dbo.vw_Session_Player_Count(Session_ID);
GO

-- 社交拓扑视图（普通视图——自连接不支持索引视图的聚簇索引创建）
DROP VIEW IF EXISTS dbo.vw_Player_Social_Edges;
GO

CREATE VIEW dbo.vw_Player_Social_Edges AS
SELECT b1.Player_User_ID AS Player_A_ID,
       b2.Player_User_ID AS Player_B_ID,
       COUNT(*) AS Co_Play_Count
FROM dbo.Bridge_Player_Registration b1
JOIN dbo.Bridge_Player_Registration b2
    ON b1.Session_ID = b2.Session_ID
    AND b1.Player_User_ID < b2.Player_User_ID
GROUP BY b1.Player_User_ID, b2.Player_User_ID;
GO

PRINT 'Indexed views created (vw_Session_Player_Count indexed; vw_Player_Social_Edges as regular view).';
GO

-- =============================================
-- 为未来 30 天批量生成 DM 排班
-- =============================================
USE STS_DAMS;
GO

DECLARE @today DATE = CAST(GETDATE() AS DATE);
DECLARE @i INT = 0;

-- 排班模板：每个 DM 的日常时间段
-- DM 2 (夜雨): 12:00 ~ 次日 02:00
-- DM 3 (沉渊): 18:00 ~ 次日 01:00
-- DM 4 (林深): 14:00 ~ 次日 00:00

WHILE @i < 30
BEGIN
    DECLARE @d DATE = DATEADD(DAY, @i, @today);

    -- DM 2 (夜雨)
    IF NOT EXISTS (SELECT 1 FROM DM_Shift_Availability_Table
                   WHERE DM_User_ID = 2 AND CAST(Available_Start AS DATE) = @d)
        INSERT INTO DM_Shift_Availability_Table (DM_User_ID, Available_Start, Available_End, Shift_Type)
        VALUES (2,
                DATEADD(HOUR, 12, CAST(@d AS DATETIME2)),
                DATEADD(HOUR, 2, CAST(DATEADD(DAY, 1, @d) AS DATETIME2)),
                'Regular');

    -- DM 3 (沉渊)
    IF NOT EXISTS (SELECT 1 FROM DM_Shift_Availability_Table
                   WHERE DM_User_ID = 3 AND CAST(Available_Start AS DATE) = @d)
        INSERT INTO DM_Shift_Availability_Table (DM_User_ID, Available_Start, Available_End, Shift_Type)
        VALUES (3,
                DATEADD(HOUR, 18, CAST(@d AS DATETIME2)),
                DATEADD(HOUR, 1, CAST(DATEADD(DAY, 1, @d) AS DATETIME2)),
                'Regular');

    -- DM 4 (林深)
    IF NOT EXISTS (SELECT 1 FROM DM_Shift_Availability_Table
                   WHERE DM_User_ID = 4 AND CAST(Available_Start AS DATE) = @d)
        INSERT INTO DM_Shift_Availability_Table (DM_User_ID, Available_Start, Available_End, Shift_Type)
        VALUES (4,
                DATEADD(HOUR, 14, CAST(@d AS DATETIME2)),
                DATEADD(HOUR, 0, CAST(DATEADD(DAY, 1, @d) AS DATETIME2)),
                'Regular');

    SET @i = @i + 1;
END
GO

SELECT DM_User_ID, COUNT(*) AS Shift_Count, MIN(Available_Start) AS Earliest, MAX(Available_End) AS Latest
FROM DM_Shift_Availability_Table
WHERE CAST(Available_Start AS DATE) >= CAST(GETDATE() AS DATE)
GROUP BY DM_User_ID;
GO

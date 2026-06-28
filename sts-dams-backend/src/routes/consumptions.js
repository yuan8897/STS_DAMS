const { Router } = require('express');
const { getPool, sql } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const router = Router();
router.use(authenticate);

// GET /api/sessions/:id/consumptions
router.get('/:id/consumptions', authorize(2, 3, 4), async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.BigInt, parseInt(req.params.id))
      .query(`SELECT c.*, i.Item_Name
              FROM Fact_Session_Consumption c
              JOIN Dim_Inventory_Item i ON i.Item_ID = c.Item_ID
              WHERE c.Session_ID = @id
              ORDER BY c.Recorded_At DESC`);
    res.json(result.recordset);
  } catch (err) {
    console.error('Get consumptions error:', err);
    res.status(500).json({ error: '获取消费明细失败' });
  }
});

// POST /api/sessions/:id/consumptions —— DM/Admin/Store_Manager 记账（批量）
router.post('/:id/consumptions', authorize(2, 3, 4), async (req, res) => {
  let transaction;
  try {
    const pool = await getPool();
    const sessionId = parseInt(req.params.id);
    const items = Array.isArray(req.body) ? req.body : [req.body];

    // 检查场次状态
    const session = await pool.request()
      .input('id', sql.BigInt, sessionId)
      .query("SELECT Session_Status FROM Fact_Session_Schedule WHERE Session_ID = @id");

    if (session.recordset.length === 0) return res.status(404).json({ error: '场次不存在' });
    if (session.recordset[0].Session_Status !== 'In_Progress') {
      return res.status(400).json({ error: '游戏未开始，无法记账' });
    }

    transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

    const inserted = [];

    for (const item of items) {
      const { Item_ID, Consumed_Quantity } = item;
      if (!Item_ID || !Consumed_Quantity || Consumed_Quantity <= 0) {
        await transaction.rollback();
        return res.status(400).json({ error: '缺少商品ID或消费数量无效' });
      }

      // 获取售价 + 锁定库存
      const inv = await transaction.request()
        .input('item', sql.Int, Item_ID)
        .query(`SELECT Selling_Unit_Price, Current_Stock_Cache
                FROM Dim_Inventory_Item WITH (UPDLOCK, ROWLOCK) WHERE Item_ID = @item`);

      if (inv.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ error: `商品 ID=${Item_ID} 不存在` });
      }

      const price = inv.recordset[0].Selling_Unit_Price;
      const stock = inv.recordset[0].Current_Stock_Cache;

      if (stock < Consumed_Quantity) {
        await transaction.rollback();
        return res.status(400).json({
          error: `物资告急: "${Item_ID}" 当前仅剩 ${stock} 件，需要 ${Consumed_Quantity} 件`,
        });
      }

      const lineTotal = price * Consumed_Quantity;

      const result = await transaction.request()
        .input('storeId', sql.Int, req.storeId)
        .input('session', sql.BigInt, sessionId)
        .input('item', sql.Int, Item_ID)
        .input('qty', sql.Int, Consumed_Quantity)
        .input('price', sql.Decimal(10, 2), price)
        .input('total', sql.Decimal(10, 2), lineTotal)
        .input('dm', sql.Int, req.user.User_ID)
        .query(`DECLARE @inserted TABLE (Consumption_ID BIGINT);
                INSERT INTO Fact_Session_Consumption
                (Store_ID, Session_ID, Item_ID, Consumed_Quantity, Unit_Price_At_Sale, Line_Total_Cost, Recording_DM_User_ID)
                OUTPUT INSERTED.Consumption_ID INTO @inserted
                VALUES (@storeId, @session, @item, @qty, @price, @total, @dm);
                SELECT Consumption_ID FROM @inserted;`);

      // trg_Consumption_AutoLedger 自动触发：写入流水 + 扣减库存

      inserted.push({
        Consumption_ID: result.recordset[0].Consumption_ID,
        Item_ID,
        Consumed_Quantity,
        Unit_Price_At_Sale: price,
        Line_Total_Cost: lineTotal,
      });
    }

    await transaction.commit();
    res.status(201).json({ message: '记账成功', details: inserted });
  } catch (err) {
    console.error('Consumption error:', err);
    try { if (transaction && !transaction._aborted) await transaction.rollback(); } catch (_) {}
    if (err.originalError) {
      return res.status(400).json({ error: err.originalError.message });
    }
    res.status(500).json({ error: '记账失败' });
  }
});

module.exports = router;

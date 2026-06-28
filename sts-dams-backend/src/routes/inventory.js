const { Router } = require('express');
const { getPool, sql } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const router = Router();
router.use(authenticate);
router.use(authorize(3, 4)); // 库存操作 Admin + Store_Manager

// GET /api/inventory
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const { category, alert } = req.query;
    let query = `SELECT *,
                        CASE WHEN Current_Stock_Cache < Safety_Alert_Threshold THEN 1 ELSE 0 END AS is_low_stock
                 FROM Dim_Inventory_Item WHERE Is_Delisted = 0`;
    const request = pool.request();
    if (category) {
      query += ` AND Item_Category = @category`;
      request.input('category', sql.NVarChar, category);
    }
    if (alert === '1') query += ' AND Current_Stock_Cache < Safety_Alert_Threshold';
    query += ' ORDER BY Item_ID';

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('List inventory error:', err);
    res.status(500).json({ error: '获取库存列表失败' });
  }
});

// GET /api/inventory/:id
router.get('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const item = await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .query('SELECT * FROM Dim_Inventory_Item WHERE Item_ID = @id');
    if (item.recordset.length === 0) return res.status(404).json({ error: '商品不存在' });

    const ledger = await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .query(`SELECT TOP 50 * FROM Inventory_Movement_Ledger
              WHERE Item_ID = @id ORDER BY Movement_At DESC`);

    res.json({ ...item.recordset[0], Recent_Movements: ledger.recordset });
  } catch (err) {
    console.error('Get item error:', err);
    res.status(500).json({ error: '获取商品详情失败' });
  }
});

// POST /api/inventory
router.post('/', async (req, res) => {
  try {
    const pool = await getPool();
    const { Item_Name, Current_Stock_Cache, Cost_Unit_Price, Selling_Unit_Price, Item_Category, Safety_Alert_Threshold } = req.body;
    if (!Item_Name || Current_Stock_Cache === undefined || !Cost_Unit_Price || !Selling_Unit_Price) {
      return res.status(400).json({ error: '缺少必填参数' });
    }
    if (Cost_Unit_Price < 0 || Selling_Unit_Price < 0) {
      return res.status(400).json({ error: '价格不能为负数' });
    }

    const result = await pool.request()
      .input('name', sql.NVarChar, Item_Name)
      .input('stock', sql.Int, Current_Stock_Cache)
      .input('cost', sql.Decimal(10, 2), Cost_Unit_Price)
      .input('sell', sql.Decimal(10, 2), Selling_Unit_Price)
      .input('cat', sql.NVarChar, Item_Category || '')
      .input('alert', sql.Int, Safety_Alert_Threshold || 10)
      .query(`INSERT INTO Dim_Inventory_Item
              (Item_Name, Current_Stock_Cache, Cost_Unit_Price, Selling_Unit_Price, Item_Category, Safety_Alert_Threshold)
              OUTPUT INSERTED.Item_ID
              VALUES (@name, @stock, @cost, @sell, @cat, @alert)`);

    const itemId = result.recordset[0].Item_ID;

    // 如果有初始库存，建期初流水
    if (Current_Stock_Cache > 0) {
      await pool.request()
        .input('item', sql.Int, itemId)
        .input('qty', sql.Int, Current_Stock_Cache)
        .input('op', sql.Int, req.user.User_ID)
        .input('storeId', sql.Int, req.storeId)
        .query(`INSERT INTO Inventory_Movement_Ledger
                (Store_ID, Item_ID, Quantity_Delta, Movement_Type, Operator_User_ID, Movement_Reason)
                VALUES (@storeId, @item, @qty, 'Initial_Stock', @op, '新增商品-期初建账')`);
    }

    res.status(201).json({ Item_ID: itemId });
  } catch (err) {
    console.error('Create item error:', err);
    res.status(500).json({ error: '新增商品失败' });
  }
});

// PUT /api/inventory/:id
router.put('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const { Item_Name, Cost_Unit_Price, Selling_Unit_Price, Item_Category, Safety_Alert_Threshold, Is_Delisted } = req.body;
    await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .input('name', sql.NVarChar, Item_Name)
      .input('cost', sql.Decimal(10, 2), Cost_Unit_Price)
      .input('sell', sql.Decimal(10, 2), Selling_Unit_Price)
      .input('cat', sql.NVarChar, Item_Category)
      .input('alert', sql.Int, Safety_Alert_Threshold)
      .input('delisted', sql.Bit, Is_Delisted)
      .query(`UPDATE Dim_Inventory_Item
              SET Item_Name = ISNULL(@name, Item_Name),
                  Cost_Unit_Price = ISNULL(@cost, Cost_Unit_Price),
                  Selling_Unit_Price = ISNULL(@sell, Selling_Unit_Price),
                  Item_Category = ISNULL(@cat, Item_Category),
                  Safety_Alert_Threshold = ISNULL(@alert, Safety_Alert_Threshold),
                  Is_Delisted = ISNULL(@delisted, Is_Delisted)
              WHERE Item_ID = @id`);
    res.json({ message: '商品更新成功' });
  } catch (err) {
    console.error('Update item error:', err);
    res.status(500).json({ error: '更新商品失败' });
  }
});

// POST /api/inventory/:id/stock-in —— 采购入库
router.post('/:id/stock-in', async (req, res) => {
  let transaction;
  try {
    const pool = await getPool();
    const { Quantity, Reason } = req.body;
    if (!Quantity || Quantity <= 0) return res.status(400).json({ error: '入库数量必须为正数' });
    const itemId = parseInt(req.params.id);

    transaction = new sql.Transaction(pool);
    await transaction.begin();

    await transaction.request()
      .input('item', sql.Int, itemId)
      .input('qty', sql.Int, Quantity)
      .input('op', sql.Int, req.user.User_ID)
      .input('reason', sql.NVarChar, Reason || '采购入库')
      .input('storeId', sql.Int, req.storeId)
      .query(`INSERT INTO Inventory_Movement_Ledger
              (Store_ID, Item_ID, Quantity_Delta, Movement_Type, Operator_User_ID, Movement_Reason)
              VALUES (@storeId, @item, @qty, 'Purchase_In', @op, @reason)`);

    await transaction.request()
      .input('item', sql.Int, itemId)
      .input('qty', sql.Int, Quantity)
      .query('UPDATE Dim_Inventory_Item SET Current_Stock_Cache = Current_Stock_Cache + @qty WHERE Item_ID = @item');

    await transaction.commit();
    res.json({ message: '采购入库成功' });
  } catch (err) {
    console.error('Stock-in error:', err);
    try { if (transaction && !transaction._aborted) await transaction.rollback(); } catch (_) {}
    res.status(500).json({ error: '入库失败' });
  }
});

// POST /api/inventory/:id/damage —— 报损出库
router.post('/:id/damage', async (req, res) => {
  let transaction;
  try {
    const pool = await getPool();
    const { Quantity, Reason } = req.body;
    if (!Quantity || Quantity <= 0) return res.status(400).json({ error: '报损数量必须为正数' });
    const itemId = parseInt(req.params.id);

    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const stock = await transaction.request()
      .input('item', sql.Int, itemId)
      .query('SELECT Current_Stock_Cache FROM Dim_Inventory_Item WITH (UPDLOCK, ROWLOCK) WHERE Item_ID = @item');
    if (stock.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ error: '商品不存在' });
    }
    if (stock.recordset[0].Current_Stock_Cache < Quantity) {
      await transaction.rollback();
      return res.status(400).json({ error: '库存不足' });
    }

    await transaction.request()
      .input('item', sql.Int, itemId)
      .input('qty', sql.Int, -Quantity)
      .input('op', sql.Int, req.user.User_ID)
      .input('reason', sql.NVarChar, Reason || '报损')
      .input('storeId', sql.Int, req.storeId)
      .query(`INSERT INTO Inventory_Movement_Ledger
              (Store_ID, Item_ID, Quantity_Delta, Movement_Type, Operator_User_ID, Movement_Reason)
              VALUES (@storeId, @item, @qty, 'Damage_Loss', @op, @reason)`);

    await transaction.request()
      .input('item', sql.Int, itemId)
      .input('qty', sql.Int, Quantity)
      .query('UPDATE Dim_Inventory_Item SET Current_Stock_Cache = Current_Stock_Cache - @qty WHERE Item_ID = @item');

    await transaction.commit();
    res.json({ message: '报损成功' });
  } catch (err) {
    console.error('Damage error:', err);
    try { if (transaction && !transaction._aborted) await transaction.rollback(); } catch (_) {}
    res.status(500).json({ error: '报损失败' });
  }
});

// POST /api/inventory/:id/adjust —— 盘点调整
router.post('/:id/adjust', async (req, res) => {
  let transaction;
  try {
    const pool = await getPool();
    const { Actual_Count, Reason } = req.body;
    if (Actual_Count === undefined || Actual_Count < 0) return res.status(400).json({ error: '实物盘点数无效' });
    const itemId = parseInt(req.params.id);

    transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const current = await transaction.request()
      .input('item', sql.Int, itemId)
      .query('SELECT Current_Stock_Cache FROM Dim_Inventory_Item WHERE Item_ID = @item');
    if (current.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ error: '商品不存在' });
    }
    const delta = Actual_Count - current.recordset[0].Current_Stock_Cache;

    if (delta !== 0) {
      await transaction.request()
        .input('item', sql.Int, itemId)
        .input('qty', sql.Int, delta)
        .input('op', sql.Int, req.user.User_ID)
        .input('reason', sql.NVarChar, Reason || '月度盘点调整')
        .input('storeId', sql.Int, req.storeId)
        .query(`INSERT INTO Inventory_Movement_Ledger
                (Store_ID, Item_ID, Quantity_Delta, Movement_Type, Operator_User_ID, Movement_Reason)
                VALUES (@storeId, @item, @qty, 'Inventory_Adjust', @op, @reason)`);

      await transaction.request()
        .input('item', sql.Int, itemId)
        .input('actual', sql.Int, Actual_Count)
        .query('UPDATE Dim_Inventory_Item SET Current_Stock_Cache = @actual WHERE Item_ID = @item');
    }

    await transaction.commit();
    res.json({ message: delta === 0 ? '库存一致，无需调整' : `盘点调整成功(Delta: ${delta})` });
  } catch (err) {
    console.error('Adjust error:', err);
    try { if (transaction && !transaction._aborted) await transaction.rollback(); } catch (_) {}
    res.status(500).json({ error: '盘点调整失败' });
  }
});

module.exports = router;

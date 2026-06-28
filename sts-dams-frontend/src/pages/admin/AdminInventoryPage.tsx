import React, { useState, useCallback } from 'react';
import { getInventoryItems, stockIn, damageOut, adjustInventory, createInventoryItem } from '../../api/inventory';
import { EmptyState } from '../../components/common/EmptyState';
import { showToast } from '../../components/common/Toast';
import type { InventoryItem, InventoryMovement } from '../../types';
import { useDataFetch } from '../../hooks/useDataFetch';
import { useApiMutation } from '../../hooks/useApiMutation';
import { MOVEMENT_TYPE_LABELS, INVENTORY_CATEGORIES } from '../../constants/maps';

const CATEGORIES = ['全部', ...INVENTORY_CATEGORIES];

export const AdminInventoryPage: React.FC = () => {
  const [filterCategory, setFilterCategory] = useState('全部');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [tab, setTab] = useState<'list' | 'detail'>('list');
  const [showStockIn, setShowStockIn] = useState(false);
  const [showDamage, setShowDamage] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [opItem, setOpItem] = useState<InventoryItem | null>(null);
  const [opQty, setOpQty] = useState(0);
  const [opReason, setOpReason] = useState('');
  const [newItem, setNewItem] = useState({
    Item_Name: '', Item_Category: '饮料', Cost_Unit_Price: 0, Selling_Unit_Price: 0,
    Current_Stock_Cache: 0, Safety_Alert_Threshold: 10,
  });

  // ─── useDataFetch: inventory items ──────────────────────────────────
  const {
    data: itemsData,
    loading: itemsLoading,
    refresh: refreshItems,
  } = useDataFetch<InventoryItem[]>({
    fetcher: useCallback(async (_signal: AbortSignal) => {
      const data = await getInventoryItems();
      return data as InventoryItem[];
    }, []),
  });

  const items: InventoryItem[] = itemsData || [];

  // ─── useDataFetch: inventory movements ──────────────────────────────
  const {
    data: movementsData,
    loading: movementsLoading,
    refresh: refreshMovements,
  } = useDataFetch<InventoryMovement[]>({
    fetcher: useCallback(async (_signal: AbortSignal) => {
      // No bulk movements API; will fall back to empty
      throw new Error('No bulk movements API');
    }, []),
  });

  const movements: InventoryMovement[] = movementsData || [];

  // ─── useApiMutation: stock in ────────────────────────────────────────
  const { execute: stockInMutation, loading: stockInLoading } = useApiMutation({
    apiFn: (data: { itemId: number; qty: number; reason?: string }) =>
      stockIn(data.itemId, data.qty, data.reason),
    successMessage: '入库成功',
  });

  // ─── useApiMutation: damage out ──────────────────────────────────────
  const { execute: damageMutation, loading: damageLoading } = useApiMutation({
    apiFn: (data: { itemId: number; qty: number; reason?: string }) =>
      damageOut(data.itemId, data.qty, data.reason),
    successMessage: '报损成功',
  });

  // ─── useApiMutation: adjust inventory ────────────────────────────────
  const { execute: adjustMutation, loading: adjustLoading } = useApiMutation({
    apiFn: (data: { itemId: number; actualCount: number }) =>
      adjustInventory(data.itemId, data.actualCount),
    successMessage: '盘点调整成功',
  });

  // ─── useApiMutation: add item ────────────────────────────────────────
  const { execute: addItemMutation, loading: addItemSaving } = useApiMutation({
    apiFn: (data: {
      Item_Name: string; Current_Stock_Cache: number;
      Cost_Unit_Price: number; Selling_Unit_Price: number;
      Item_Category: string; Safety_Alert_Threshold?: number;
    }) => createInventoryItem(data),
    successMessage: '商品添加成功',
  });

  // ─── Filtering ───────────────────────────────────────────────────────
  let filtered = items;
  if (filterCategory !== '全部') {
    filtered = filtered.filter(i => i.Item_Category === filterCategory);
  }
  if (search) {
    filtered = filtered.filter(i => i.Item_Name.toLowerCase().includes(search.toLowerCase()));
  }

  // ─── Handlers ────────────────────────────────────────────────────────
  const handleStockIn = async () => {
    if (!opItem || opQty <= 0) return;

    const result = await stockInMutation({
      itemId: opItem.Item_ID,
      qty: opQty,
      reason: opReason || '采购入库',
    });

    if (result !== null) {
      setShowStockIn(false);
      setOpQty(0);
      setOpReason('');
      refreshItems();
      refreshMovements();
    }
  };

  const handleDamage = async () => {
    if (!opItem || opQty <= 0) return;
    if (opItem.Current_Stock_Cache < opQty) {
      showToast('库存不足', 'error');
      return;
    }

    const result = await damageMutation({
      itemId: opItem.Item_ID,
      qty: opQty,
      reason: opReason || '报损出库',
    });

    if (result !== null) {
      setShowDamage(false);
      setOpQty(0);
      setOpReason('');
      refreshItems();
      refreshMovements();
    }
  };

  const handleAdjust = async () => {
    if (!opItem) return;
    const delta = opQty - opItem.Current_Stock_Cache;
    if (delta === 0) { setShowAdjust(false); return; }

    const result = await adjustMutation({
      itemId: opItem.Item_ID,
      actualCount: opQty,
    });

    if (result !== null) {
      setShowAdjust(false);
      setOpQty(0);
      refreshItems();
      refreshMovements();
    }
  };

  const handleAddItem = async () => {
    if (!newItem.Item_Name || newItem.Cost_Unit_Price < 0 || newItem.Selling_Unit_Price < newItem.Cost_Unit_Price) return;

    const result = await addItemMutation({
      Item_Name: newItem.Item_Name,
      Current_Stock_Cache: newItem.Current_Stock_Cache,
      Cost_Unit_Price: newItem.Cost_Unit_Price,
      Selling_Unit_Price: newItem.Selling_Unit_Price,
      Item_Category: newItem.Item_Category,
      Safety_Alert_Threshold: newItem.Safety_Alert_Threshold,
    });

    if (result !== null) {
      // If item had initial stock, create an initial stock movement via API
      if (newItem.Current_Stock_Cache > 0 && result.Item_ID) {
        try {
          await stockIn(result.Item_ID, newItem.Current_Stock_Cache, '初始库存');
        } catch {
          // Initial stock movement is non-critical
        }
      }

      setShowAddItem(false);
      setNewItem({
        Item_Name: '', Item_Category: '饮料', Cost_Unit_Price: 0, Selling_Unit_Price: 0,
        Current_Stock_Cache: 0, Safety_Alert_Threshold: 10,
      });
      refreshItems();
      if (newItem.Current_Stock_Cache > 0) refreshMovements();
    }
  };

  // Movements for selected item (sorted desc)
  const itemMovements = selectedItem
    ? movements
        .filter(m => m.Item_ID === selectedItem.Item_ID)
        .sort((a, b) => new Date(b.Movement_At).getTime() - new Date(a.Movement_At).getTime())
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">库存管理</h2>
          <p className="text-sm text-gray-400 mt-0.5">物资列表 · 入库/报损/盘点 · 流水追溯</p>
        </div>
        <button onClick={() => setShowAddItem(true)} className="btn-primary text-sm px-4 py-1.5">+ 新增商品</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="搜索商品名称..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field text-sm w-48"
        />
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              filterCategory === cat ? 'bg-accent-purple text-white border-accent-purple' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}
          >{cat}</button>
        ))}
      </div>

      {/* Alert items count */}
      {items.filter(i => i.Current_Stock_Cache < i.Safety_Alert_Threshold && !i.Is_Delisted).length > 0 && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100">
          ⚠ {items.filter(i => i.Current_Stock_Cache < i.Safety_Alert_Threshold && !i.Is_Delisted).length} 种商品库存低于安全线
        </div>
      )}

      {/* Inventory table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50/50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">商品名称</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">分类</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs">当前库存</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs">成本价</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs">零售价</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs">预警线</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500 text-xs">状态</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500 text-xs">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => {
              const isLow = item.Current_Stock_Cache < item.Safety_Alert_Threshold;
              return (
                <tr key={item.Item_ID} className={`border-b border-gray-50 hover:bg-gray-50/30 transition-colors ${isLow ? 'bg-red-50/30' : ''} ${item.Is_Delisted ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-800">{item.Item_Name}</span>
                    {item.Is_Delisted && <span className="text-[12px] text-gray-400 ml-1">(已下架)</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{item.Item_Category}</td>
                  <td className={`px-4 py-3 text-right font-mono font-medium ${isLow ? 'text-red-500' : 'text-gray-700'}`}>
                    {item.Current_Stock_Cache}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">¥{item.Cost_Unit_Price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-accent-pink font-medium">¥{item.Selling_Unit_Price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{item.Safety_Alert_Threshold}</td>
                  <td className="px-4 py-3 text-center">
                    {isLow ? <span className="text-[12px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">库存紧张</span>
                      : item.Is_Delisted ? <span className="text-[12px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">已下架</span>
                      : <span className="text-[12px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded">正常</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={() => { setOpItem(item); setOpQty(0); setShowStockIn(true); }}
                        className="text-[12px] px-2 py-0.5 bg-green-50 text-green-600 rounded hover:bg-green-100"
                        disabled={item.Is_Delisted}
                      >入库</button>
                      <button
                        onClick={() => { setOpItem(item); setOpQty(0); setShowDamage(true); }}
                        className="text-[12px] px-2 py-0.5 bg-orange-50 text-orange-600 rounded hover:bg-orange-100"
                        disabled={item.Is_Delisted}
                      >报损</button>
                      <button
                        onClick={() => { setOpItem(item); setOpQty(item.Current_Stock_Cache); setShowAdjust(true); }}
                        className="text-[12px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                        disabled={item.Is_Delisted}
                      >盘点</button>
                      <button
                        onClick={() => { setSelectedItem(item); setTab('detail'); }}
                        className="text-[12px] px-2 py-0.5 bg-gray-50 text-gray-500 rounded hover:bg-gray-100"
                      >流水</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Movement ledger for selected item */}
      {tab === 'detail' && selectedItem && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => { setTab('list'); setSelectedItem(null); }} className="text-sm text-gray-400 hover:text-gray-600">← 返回</button>
            <h3 className="text-lg font-semibold text-gray-800">{selectedItem.Item_Name} · 库存流水</h3>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">时间</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">类型</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-500 text-xs">数量变动</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">备注</th>
                </tr>
              </thead>
              <tbody>
                {itemMovements.map(m => (
                  <tr key={m.Movement_ID} className="border-b border-gray-50">
                    <td className="px-4 py-2 text-gray-500">{new Date(m.Movement_At).toLocaleString('zh-CN')}</td>
                    <td className="px-4 py-2">
                      <span className={`text-[12px] px-1.5 py-0.5 rounded ${
                        m.Quantity_Delta > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                      }`}>{MOVEMENT_TYPE_LABELS[m.Movement_Type] || m.Movement_Type}</span>
                    </td>
                    <td className={`px-4 py-2 text-right font-mono font-medium ${m.Quantity_Delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {m.Quantity_Delta > 0 ? '+' : ''}{m.Quantity_Delta}
                    </td>
                    <td className="px-4 py-2 text-gray-400 text-xs">{m.Movement_Reason || '-'}</td>
                  </tr>
                ))}
                {itemMovements.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-gray-400">暂无流水记录</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock-in Dialog */}
      {showStockIn && opItem && (
        <Dialog title="采购入库" onClose={() => setShowStockIn(false)}>
          <p className="text-sm text-gray-500 mb-3">商品: <strong>{opItem.Item_Name}</strong> (当前库存: {opItem.Current_Stock_Cache})</p>
          <input type="number" min={1} value={opQty || ''} onChange={e => setOpQty(parseInt(e.target.value) || 0)} placeholder="入库数量" className="input-field text-sm mb-2" />
          <input type="text" value={opReason} onChange={e => setOpReason(e.target.value)} placeholder="备注（可选）" className="input-field text-sm mb-3" />
          <div className="flex gap-2">
            <button onClick={() => setShowStockIn(false)} className="btn-secondary text-sm flex-1">取消</button>
            <button onClick={handleStockIn} disabled={stockInLoading} className="btn-primary text-sm flex-1">
              {stockInLoading ? '处理中...' : '确认入库'}
            </button>
          </div>
        </Dialog>
      )}

      {/* Damage Dialog */}
      {showDamage && opItem && (
        <Dialog title="报损出库" onClose={() => setShowDamage(false)}>
          <p className="text-sm text-gray-500 mb-3">商品: <strong>{opItem.Item_Name}</strong> (当前库存: {opItem.Current_Stock_Cache})</p>
          <input type="number" min={1} max={opItem.Current_Stock_Cache} value={opQty || ''} onChange={e => setOpQty(parseInt(e.target.value) || 0)} placeholder="报损数量" className="input-field text-sm mb-2" />
          <input type="text" value={opReason} onChange={e => setOpReason(e.target.value)} placeholder="报损原因" className="input-field text-sm mb-3" />
          <div className="flex gap-2">
            <button onClick={() => setShowDamage(false)} className="btn-secondary text-sm flex-1">取消</button>
            <button onClick={handleDamage} disabled={damageLoading} className="btn-danger text-sm flex-1">
              {damageLoading ? '处理中...' : '确认报损'}
            </button>
          </div>
        </Dialog>
      )}

      {/* Adjust Dialog */}
      {showAdjust && opItem && (
        <Dialog title="盘点调整" onClose={() => setShowAdjust(false)}>
          <p className="text-sm text-gray-500 mb-3">商品: <strong>{opItem.Item_Name}</strong> (系统库存: {opItem.Current_Stock_Cache})</p>
          <input type="number" min={0} value={opQty || ''} onChange={e => setOpQty(parseInt(e.target.value) || 0)} placeholder="实物盘点数" className="input-field text-sm mb-2" />
          {opQty !== opItem.Current_Stock_Cache && (
            <p className="text-xs text-orange-500 mb-3">Delta: {opQty - opItem.Current_Stock_Cache > 0 ? '+' : ''}{opQty - opItem.Current_Stock_Cache}</p>
          )}
          <div className="flex gap-2">
            <button onClick={() => setShowAdjust(false)} className="btn-secondary text-sm flex-1">取消</button>
            <button onClick={handleAdjust} disabled={adjustLoading} className="btn-primary text-sm flex-1">
              {adjustLoading ? '处理中...' : '确认调整'}
            </button>
          </div>
        </Dialog>
      )}

      {/* Add Item Dialog */}
      {showAddItem && (
        <Dialog title="新增商品" onClose={() => setShowAddItem(false)}>
          <input type="text" value={newItem.Item_Name} onChange={e => setNewItem({ ...newItem, Item_Name: e.target.value })} placeholder="商品名称" className="input-field text-sm mb-2" />
          <select value={newItem.Item_Category} onChange={e => setNewItem({ ...newItem, Item_Category: e.target.value })} className="input-field text-sm mb-2">
            {INVENTORY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input type="number" min={0} step={0.01} value={newItem.Cost_Unit_Price || ''} onChange={e => setNewItem({ ...newItem, Cost_Unit_Price: parseFloat(e.target.value) || 0 })} placeholder="成本价" className="input-field text-sm" />
            <input type="number" min={0} step={0.01} value={newItem.Selling_Unit_Price || ''} onChange={e => setNewItem({ ...newItem, Selling_Unit_Price: parseFloat(e.target.value) || 0 })} placeholder="零售价" className="input-field text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <input type="number" min={0} value={newItem.Current_Stock_Cache || ''} onChange={e => setNewItem({ ...newItem, Current_Stock_Cache: parseInt(e.target.value) || 0 })} placeholder="初始库存" className="input-field text-sm" />
            <input type="number" min={0} value={newItem.Safety_Alert_Threshold || ''} onChange={e => setNewItem({ ...newItem, Safety_Alert_Threshold: parseInt(e.target.value) || 0 })} placeholder="预警线" className="input-field text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAddItem(false)} className="btn-secondary text-sm flex-1">取消</button>
            <button onClick={handleAddItem} disabled={addItemSaving} className="btn-primary text-sm flex-1">
              {addItemSaving ? '保存中...' : '确认添加'}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
};

const Dialog: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="absolute inset-0 bg-black/40" onClick={onClose} />
    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
      {children}
    </div>
  </div>
);

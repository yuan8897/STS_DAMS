import React, { useState } from 'react';
import { formatTime } from '../../utils/format';
import { getInventoryItems } from '../../api/inventory';
import { getSessionConsumptions, createConsumptions } from '../../api/consumptions';
import { useDataFetch } from '../../hooks/useDataFetch';
import { useApiMutation } from '../../hooks/useApiMutation';
import { Loading } from '../../components/common/Loading';
import { ErrorState } from '../../components/common/ErrorState';
import { showToast } from '../../components/common/Toast';
import type { CartItem, SessionConsumption, InventoryItem } from '../../types';

interface ConsumptionCartProps {
  sessionId: number;
  dmUserId: number;
}

export const ConsumptionCart: React.FC<ConsumptionCartProps> = ({ sessionId, dmUserId }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('全部');

  const { data: storeData, loading, error, refresh } = useDataFetch({
    fetcher: async (_signal) => {
      const [items, cons] = await Promise.all([
        getInventoryItems(),
        getSessionConsumptions(sessionId),
      ]);
      return { items, consumptions: cons };
    },
  });

  const inventoryItems = storeData?.items || [];
  const consumptions = storeData?.consumptions || [];

  const { execute: submitConsumptions, loading: submiting } = useApiMutation({
    apiFn: (params: { sessionId: number; items: { Item_ID: number; Consumed_Quantity: number }[] }) =>
      createConsumptions(params.sessionId, params.items),
    successMessage: '记账成功！',
  });

  const categories = ['全部', ...new Set(inventoryItems.map(i => i.Item_Category))];
  const filteredItems = activeCategory === '全部'
    ? inventoryItems.filter(i => !i.Is_Delisted)
    : inventoryItems.filter(i => i.Item_Category === activeCategory && !i.Is_Delisted);

  const addToCart = (item: InventoryItem) => {
    if (item.Current_Stock_Cache <= 0) {
      showToast(`${item.Item_Name} 库存不足`, 'error');
      return;
    }
    setCartItems(prev => {
      const existing = prev.find(ci => ci.Item_ID === item.Item_ID);
      if (existing) {
        if (existing.Quantity >= item.Current_Stock_Cache) {
          showToast(`${item.Item_Name} 库存不足（当前仅剩 ${item.Current_Stock_Cache} 件）`, 'warning');
          return prev;
        }
        return prev.map(ci =>
          ci.Item_ID === item.Item_ID
            ? { ...ci, Quantity: ci.Quantity + 1, Line_Total: (ci.Quantity + 1) * ci.Selling_Unit_Price }
            : ci
        );
      }
      return [...prev, { Item_ID: item.Item_ID, Item_Name: item.Item_Name, Selling_Unit_Price: item.Selling_Unit_Price, Quantity: 1, Line_Total: item.Selling_Unit_Price }];
    });
  };

  const removeFromCart = (itemId: number) => {
    setCartItems(prev => {
      const existing = prev.find(ci => ci.Item_ID === itemId);
      if (!existing) return prev;
      if (existing.Quantity <= 1) return prev.filter(ci => ci.Item_ID !== itemId);
      return prev.map(ci =>
        ci.Item_ID === itemId
          ? { ...ci, Quantity: ci.Quantity - 1, Line_Total: (ci.Quantity - 1) * ci.Selling_Unit_Price }
          : ci
      );
    });
  };

  const cartTotal = cartItems.reduce((sum, ci) => sum + ci.Line_Total, 0);

  const handleSubmit = async () => {
    if (submiting) return;
    if (cartItems.length === 0) { showToast('请先添加商品', 'warning'); return; }
    for (const ci of cartItems) {
      const item = inventoryItems.find(i => i.Item_ID === ci.Item_ID);
      if (item && item.Current_Stock_Cache < ci.Quantity) {
        showToast(`${ci.Item_Name} 库存不足（当前仅剩 ${item.Current_Stock_Cache} 件）`, 'error');
        return;
      }
    }

    const items = cartItems.map(ci => ({
      Item_ID: ci.Item_ID,
      Consumed_Quantity: ci.Quantity,
    }));

    await submitConsumptions({ sessionId, items });
    setCartItems([]);
    refresh();
  };

  if (loading) return <Loading text="加载商品列表..." />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <div className="space-y-5">
      {/* Cart */}
      {cartItems.length > 0 && (
        <div className="card bg-purple-50/40 border-purple-200">
          <h3 className="font-semibold text-gray-900 mb-3">购物车</h3>
          <div className="space-y-2">
            {cartItems.map(ci => (
              <div key={ci.Item_ID} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={() => removeFromCart(ci.Item_ID)} className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center text-sm text-gray-500 hover:bg-gray-100">−</button>
                  <span className="text-gray-700 font-medium text-sm">{ci.Item_Name} ×{ci.Quantity}</span>
                  <button onClick={() => { const item = inventoryItems.find(i => i.Item_ID === ci.Item_ID); if (item) addToCart(item); }} className="w-7 h-7 rounded-full bg-accent-purple flex items-center justify-center text-sm text-white hover:opacity-80">+</button>
                </div>
                <span className="font-semibold text-gray-900">¥{ci.Line_Total.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-purple-200">
            <span className="font-semibold text-gray-900">合计</span>
            <span className="text-xl font-bold text-accent-pink">¥{cartTotal.toFixed(2)}</span>
          </div>
          <button onClick={handleSubmit} disabled={submiting} className="btn-primary w-full mt-3">
            {submiting ? '记账中...' : '确认记账'}
          </button>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeCategory === cat ? 'bg-accent-purple text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >{cat}</button>
        ))}
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {filteredItems.map(item => {
          const isLow = item.Current_Stock_Cache < item.Safety_Alert_Threshold;
          const soldOut = item.Current_Stock_Cache <= 0;
          return (
            <button key={item.Item_ID} onClick={() => !soldOut && addToCart(item)} disabled={soldOut}
              className={`p-4 rounded-xl border text-left transition-all ${soldOut ? 'bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed' : 'bg-white border-gray-100 hover:border-accent-purple hover:shadow-sm active:bg-purple-50'}`}
            >
              <div className="text-sm font-semibold text-gray-900 truncate">{item.Item_Name}</div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-base font-bold text-accent-pink">¥{item.Selling_Unit_Price}</span>
                <span className={`text-xs ${isLow ? 'text-red-400 font-medium' : 'text-gray-400'}`}>
                  {soldOut ? '售罄' : `剩${item.Current_Stock_Cache}`}
                </span>
              </div>
              {isLow && !soldOut && <div className="text-[12px] text-red-400 mt-1">库存紧张</div>}
            </button>
          );
        })}
      </div>

      {/* Recorded consumptions */}
      {consumptions.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3">已记账明细</h3>
          <div className="divide-y divide-gray-50">
            {consumptions.map(c => (
              <div key={c.Consumption_ID} className="flex items-center justify-between py-2.5">
                <div>
                  <span className="text-sm text-gray-700 font-medium">{c.Item_Name} ×{c.Consumed_Quantity}</span>
                  <span className="text-xs text-gray-400 ml-2">¥{c.Unit_Price_At_Sale}/件</span>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-gray-900 text-sm">¥{c.Line_Total_Cost.toFixed(2)}</span>
                  <div className="text-[11px] text-gray-400">{formatTime(c.Recorded_At)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { getTemplates, createTemplate, updateTemplate, toggleTemplate } from '../../../api/coupons';
import { showToast } from '../../../components/common/Toast';
import { useDataFetch } from '../../../hooks/useDataFetch';
import { useApiMutation } from '../../../hooks/useApiMutation';
import type { CouponTemplate } from '../../../types';

export const CouponTemplatesPage: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    Coupon_Name: '', Discount_Type: 'Fixed_Amount' as string, Discount_Value: 0,
    Min_Order_Amount: 0, Max_Discount_Cap: 0, Valid_Days_From_Issue: 30,
    Applicable_Script_ID: 0, Per_User_Limit: 1,
  });

  // ====== Data fetch ======
  const { data: templates = [], refresh } = useDataFetch<CouponTemplate[]>({
    fetcher: (_signal: AbortSignal) => getTemplates(),
  });

  const resetForm = () => {
    setForm({ Coupon_Name: '', Discount_Type: 'Fixed_Amount', Discount_Value: 0, Min_Order_Amount: 0, Max_Discount_Cap: 0, Valid_Days_From_Issue: 30, Applicable_Script_ID: 0, Per_User_Limit: 1 });
    setEditingId(null); setShowForm(false);
  };

  // ====== Create mutation ======
  const { execute: createCoupon, loading: creating } = useApiMutation({
    apiFn: (data: typeof form) => createTemplate(data),
    successMessage: '模板创建成功',
  });

  // ====== Update mutation ======
  const { execute: updateCoupon, loading: updating } = useApiMutation({
    apiFn: (params: { id: number; data: Record<string, unknown> }) => updateTemplate(params.id, params.data),
    successMessage: '模板更新成功',
  });

  // ====== Toggle mutation ======
  const { execute: toggleCoupon } = useApiMutation({
    apiFn: (id: number) => toggleTemplate(id),
    successMessage: '状态切换成功',
  });

  const handleSave = async () => {
    if (!form.Coupon_Name || form.Discount_Value <= 0) { showToast('请填写完整信息', 'error'); return; }
    const result = editingId
      ? await updateCoupon({ id: editingId, data: form as unknown as Record<string, unknown> })
      : await createCoupon(form);
    if (result) {
      refresh();
      resetForm();
    }
  };

  const handleToggle = async (id: number) => {
    await toggleCoupon(id);
    refresh();
  };

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">优惠券模板管理</h2>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary text-sm">新增模板</button>
      </div>

      <div className="space-y-2">
        {(templates || []).map(t => (
          <div key={t.Template_ID} className={`card flex items-center justify-between ${!t.Is_Active ? 'opacity-50' : ''}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-sm text-gray-900">{t.Coupon_Name}</h4>
                <span className={`badge text-[12px] ${t.Is_Active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                  {t.Is_Active ? '启用' : '停用'}
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {t.Discount_Type === 'Fixed_Amount' ? `减 ¥${t.Discount_Value}` : `${((1 - t.Discount_Value) * 100).toFixed(0)}折`}
                {t.Min_Order_Amount > 0 && ` · 满 ¥${t.Min_Order_Amount} 可用`}
                {t.Max_Discount_Cap && ` · 最高优惠 ¥${t.Max_Discount_Cap}`}
                {t.Script_Title && ` · 仅限《${t.Script_Title}》`}
                <span className="ml-1">· 有效期 {t.Valid_Days_From_Issue} 天 · 限领 {t.Per_User_Limit} 张</span>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-3">
              <button onClick={() => { setEditingId(t.Template_ID); setForm({ Coupon_Name: t.Coupon_Name, Discount_Type: t.Discount_Type, Discount_Value: t.Discount_Value, Min_Order_Amount: t.Min_Order_Amount, Max_Discount_Cap: t.Max_Discount_Cap || 0, Valid_Days_From_Issue: t.Valid_Days_From_Issue, Applicable_Script_ID: t.Applicable_Script_ID || 0, Per_User_Limit: t.Per_User_Limit }); setShowForm(true); }}
                className="text-xs text-purple-600 hover:underline">编辑</button>
              <button onClick={() => handleToggle(t.Template_ID)}
                className={`text-xs px-2 py-1 rounded ${t.Is_Active ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                {t.Is_Active ? '停用' : '启用'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 表单弹窗 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={resetForm}>
          <div className="bg-white rounded-xl p-6 w-[480px] max-w-[90vw] max-h-[85vh] overflow-y-auto space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900">{editingId ? '编辑模板' : '新增模板'}</h3>
            <div>
              <label className="text-xs text-gray-500">优惠券名称</label>
              <input className="input-field w-full mt-1 text-sm" value={form.Coupon_Name}
                onChange={e => setForm({ ...form, Coupon_Name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">优惠类型</label>
                <select className="input-field w-full mt-1 text-sm" value={form.Discount_Type}
                  onChange={e => setForm({ ...form, Discount_Type: e.target.value })}>
                  <option value="Fixed_Amount">固定金额</option>
                  <option value="Percent_Off">百分比折扣</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">{form.Discount_Type === 'Fixed_Amount' ? '金额 (元)' : '折扣比例 (0.1=9折)'}</label>
                <input type="number" step="0.01" className="input-field w-full mt-1 text-sm" value={form.Discount_Value}
                  onChange={e => setForm({ ...form, Discount_Value: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">最低消费 (元)</label>
                <input type="number" className="input-field w-full mt-1 text-sm" value={form.Min_Order_Amount}
                  onChange={e => setForm({ ...form, Min_Order_Amount: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs text-gray-500">折扣上限 (元, 百分比券)</label>
                <input type="number" className="input-field w-full mt-1 text-sm" value={form.Max_Discount_Cap}
                  onChange={e => setForm({ ...form, Max_Discount_Cap: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">有效期 (天)</label>
                <input type="number" className="input-field w-full mt-1 text-sm" value={form.Valid_Days_From_Issue}
                  onChange={e => setForm({ ...form, Valid_Days_From_Issue: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs text-gray-500">每人限领 (张)</label>
                <input type="number" className="input-field w-full mt-1 text-sm" value={form.Per_User_Limit}
                  onChange={e => setForm({ ...form, Per_User_Limit: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={resetForm} className="btn-secondary flex-1 text-sm">取消</button>
              <button onClick={handleSave} disabled={creating || updating} className="btn-primary flex-1 text-sm disabled:opacity-50">
                {creating || updating ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

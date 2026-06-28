import React, { useState } from 'react';
import { LEVEL_NAMES, LEVEL_COLORS } from '../../../constants/maps';
import { getLevels, createLevel, updateLevel, deleteLevel } from '../../../api/membership';
import { showToast } from '../../../components/common/Toast';
import { useDataFetch } from '../../../hooks/useDataFetch';
import { useApiMutation } from '../../../hooks/useApiMutation';
import type { MemberLevel } from '../../../types';

export const MemberLevelsPage: React.FC = () => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ Level_Name: '', Min_Required_Points: 0, Discount_Rate: 1.0, Point_Earning_Multiplier: 1.0 });

  // ====== Data fetch ======
  const { data: levels = [], refresh } = useDataFetch<MemberLevel[]>({
    fetcher: (_signal: AbortSignal) => getLevels(),
  });

  // ====== Create mutation ======
  const { execute: doCreate, loading: creating } = useApiMutation({
    apiFn: (data: typeof form) => createLevel(data),
    successMessage: '等级创建成功',
  });

  // ====== Update mutation ======
  const { execute: doUpdate, loading: updating } = useApiMutation({
    apiFn: (params: { id: number; data: typeof form }) => updateLevel(params.id, params.data),
    successMessage: '等级更新成功',
  });

  // ====== Delete mutation ======
  const { execute: doDelete, loading: deleting } = useApiMutation({
    apiFn: (id: number) => deleteLevel(id),
    successMessage: '等级已删除',
  });

  const handleSave = async () => {
    if (!form.Level_Name) { showToast('请输入等级名称', 'error'); return; }
    const result = editingId
      ? await doUpdate({ id: editingId, data: form })
      : await doCreate(form);
    if (result) {
      refresh();
      setShowNew(false); setEditingId(null);
    }
  };

  const openEdit = (l: MemberLevel) => {
    setEditingId(l.Level_ID);
    setForm({ Level_Name: l.Level_Name, Min_Required_Points: l.Min_Required_Points, Discount_Rate: l.Discount_Rate, Point_Earning_Multiplier: l.Point_Earning_Multiplier });
    setShowNew(true);
  };

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">会员等级配置</h2>
        <button onClick={() => { setEditingId(null); setForm({ Level_Name: '', Min_Required_Points: 0, Discount_Rate: 1.0, Point_Earning_Multiplier: 1.0 }); setShowNew(true); }}
          className="btn-primary text-sm">新增等级</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 px-3 text-gray-500 font-medium">等级</th>
              <th className="text-left py-2 px-3 text-gray-500 font-medium">名称</th>
              <th className="text-right py-2 px-3 text-gray-500 font-medium">最低积分</th>
              <th className="text-right py-2 px-3 text-gray-500 font-medium">折扣率</th>
              <th className="text-right py-2 px-3 text-gray-500 font-medium">积分倍率</th>
              <th className="text-center py-2 px-3 text-gray-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {(levels || []).map(l => (
              <tr key={l.Level_ID} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2 px-3">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: LEVEL_COLORS[l.Level_Name] || '#888' }} />
                </td>
                <td className="py-2 px-3 font-medium">{LEVEL_NAMES[l.Level_Name] || l.Level_Name}</td>
                <td className="py-2 px-3 text-right">{l.Min_Required_Points.toLocaleString()}</td>
                <td className="py-2 px-3 text-right">{(l.Discount_Rate * 100).toFixed(0)}%</td>
                <td className="py-2 px-3 text-right">{l.Point_Earning_Multiplier.toFixed(2)}×</td>
                <td className="py-2 px-3 text-center">
                  <button onClick={() => openEdit(l)} className="text-xs text-purple-600 hover:underline">编辑</button>
                  <button onClick={async () => {
                    if (!window.confirm(`确定要删除「${LEVEL_NAMES[l.Level_Name] || l.Level_Name}」等级吗？`)) return;
                    const result = await doDelete(l.Level_ID);
                    if (result) refresh();
                  }} disabled={deleting}
                    className="text-xs text-red-500 hover:underline ml-3 disabled:opacity-50">删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 新增/编辑弹窗 */}
      {showNew && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-xl p-6 w-[400px] max-w-[90vw] space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900">{editingId ? '编辑等级' : '新增等级'}</h3>
            <div>
              <label className="text-xs text-gray-500">英文名称</label>
              <input className="input-field w-full mt-1 text-sm" value={form.Level_Name}
                onChange={e => setForm({ ...form, Level_Name: e.target.value })} placeholder="如 Gold" />
            </div>
            <div>
              <label className="text-xs text-gray-500">最低所需积分</label>
              <input type="number" className="input-field w-full mt-1 text-sm" value={form.Min_Required_Points}
                onChange={e => setForm({ ...form, Min_Required_Points: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs text-gray-500">折扣率 (0~1, 如 0.95 = 95折)</label>
              <input type="number" step="0.001" className="input-field w-full mt-1 text-sm" value={form.Discount_Rate}
                onChange={e => setForm({ ...form, Discount_Rate: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs text-gray-500">积分倍率</label>
              <input type="number" step="0.01" className="input-field w-full mt-1 text-sm" value={form.Point_Earning_Multiplier}
                onChange={e => setForm({ ...form, Point_Earning_Multiplier: Number(e.target.value) })} />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => { setShowNew(false); setEditingId(null); }} className="btn-secondary flex-1 text-sm">取消</button>
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

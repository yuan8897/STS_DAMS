import React, { useState, useMemo } from 'react';
import { formatDateTime } from '../../../utils/format';
import { getUsageLog, deleteUsageLog } from '../../../api/coupons';
import { EmptyState } from '../../../components/common/EmptyState';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { showToast } from '../../../components/common/Toast';
import { useDataFetch } from '../../../hooks/useDataFetch';
import { useApiMutation } from '../../../hooks/useApiMutation';

export const CouponUsagePage: React.FC = () => {
  const [filterTemplate, setFilterTemplate] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  // ====== Data fetch ======
  const { data: records = [], refresh } = useDataFetch<Record<string, unknown>[]>({
    fetcher: (_signal: AbortSignal) => getUsageLog(),
  });

  // ====== Delete mutation ======
  const { execute: doDelete, loading: deleting } = useApiMutation({
    apiFn: (id: number) => deleteUsageLog(id),
    successMessage: '核销记录已删除',
  });

  const handleDeleteConfirm = async () => {
    if (deleteTarget === null) return;
    const result = await doDelete(deleteTarget);
    setDeleteTarget(null);
    if (result !== null) refresh();
  };

  // Derive unique templates from usage records
  const templates = useMemo(() => {
    const map = new Map<number, { Template_ID: number; Coupon_Name: string }>();
    (records || []).forEach(r => {
      const tid = Number(r.Template_ID);
      if (tid && !map.has(tid)) {
        map.set(tid, { Template_ID: tid, Coupon_Name: String(r.Coupon_Name || '') });
      }
    });
    return Array.from(map.values());
  }, [records]);

  const filtered = filterTemplate === 'all'
    ? (records || [])
    : (records || []).filter(r => r.Template_ID === Number(filterTemplate));

  return (
    <div className="py-4 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">核销记录</h2>

      {/* 模板筛选 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setFilterTemplate('all')}
          className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${filterTemplate === 'all' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
          全部
        </button>
        {templates.map(t => (
          <button key={t.Template_ID} onClick={() => setFilterTemplate(String(t.Template_ID))}
            className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${filterTemplate === String(t.Template_ID) ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
            {t.Coupon_Name}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🧾" title="暂无核销记录" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-3 text-gray-500 font-medium">优惠券</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">用户</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">抵扣金额</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">使用时间</th>
                <th className="text-center py-2 px-3 text-gray-500 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => (
                <tr key={idx} className="border-b border-gray-50 group">
                  <td className="py-2 px-3 text-gray-900">{String(r.Coupon_Name || '')}</td>
                  <td className="py-2 px-3 text-gray-600">{String(r.User_Name || '')}</td>
                  <td className="py-2 px-3 text-right text-accent-pink font-medium">¥{String(r.Discount_Amount || '')}</td>
                  <td className="py-2 px-3 text-gray-400 text-xs">{formatDateTime(String(r.Recorded_At || ''))}</td>
                  <td className="py-2 px-3 text-center">
                    <button
                      onClick={() => setDeleteTarget(Number(r.Usage_ID))}
                      disabled={deleting}
                      className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                      title="删除核销记录"
                    >
                      🗑 删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除核销记录"
        message="确定删除此核销记录？此操作不可撤销。"
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

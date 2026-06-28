import React, { useState } from 'react';
import { getAuditLogs } from '../../api/audit';
import { exportPayments, exportInventory, exportAuditLogs } from '../../api/exports';
import { getStoreInfo, updateStoreInfo } from '../../api/store';
import { getGenres, createGenre, updateGenre, deleteGenre } from '../../api/lookup';
import { showToast } from '../../components/common/Toast';
import { useDataFetch } from '../../hooks/useDataFetch';
import { useApiMutation } from '../../hooks/useApiMutation';
import type { GenreItem } from '../../api/lookup';

const ACTION_TYPES = ['CREATE_SESSION', 'CANCEL_SESSION', 'ISSUE_REFUND', 'ADJUST_INVENTORY', 'MODIFY_DM_SHIFT', 'UPDATE_SESSION', 'USER_LOGIN'];

export const AdminSettingsPage: React.FC = () => {
  const [tab, setTab] = useState<'store' | 'audit' | 'lookup'>('store');
  const [auditFilter, setAuditFilter] = useState({ action: '', entity: '', operator: '' });
  const [newGenre, setNewGenre] = useState('');

  // Export state
  const today = new Date().toISOString().slice(0, 10);
  const lastMonth = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [exportFrom, setExportFrom] = useState(lastMonth);
  const [exportTo, setExportTo] = useState(today);
  const [exporting, setExporting] = useState<string | null>(null);

  // ====== Store info via API ======
  const { data: storeInfo, loading: storeLoading, refresh: refreshStore } = useDataFetch({
    fetcher: () => getStoreInfo(),
  });

  const [localStoreInfo, setLocalStoreInfo] = useState({ name: '', address: '', phone: '', email: '' });
  const [storeInitialized, setStoreInitialized] = useState(false);

  // Sync API store info to local state
  React.useEffect(() => {
    if (storeInfo && !storeInitialized) {
      setLocalStoreInfo({
        name: storeInfo.name || '',
        address: storeInfo.address || '',
        phone: storeInfo.phone || '',
        email: storeInfo.email || '',
      });
      setStoreInitialized(true);
    }
  }, [storeInfo, storeInitialized]);

  const { execute: handleSaveStoreInfo, loading: savingStore } = useApiMutation({
    apiFn: (data: { name: string; address: string; phone: string; email: string }) =>
      updateStoreInfo(data),
    successMessage: '门店信息已保存',
  });

  // ====== Genre management via API ======
  const { data: apiGenres, refresh: refreshGenres } = useDataFetch<GenreItem[]>({
    fetcher: (_signal) => getGenres(),
  });

  const genresMap: Record<number, string> = {};
  if (apiGenres) {
    apiGenres.forEach(g => { genresMap[g.Genre_ID] = g.Genre_Name; });
  }

  const { execute: handleSaveGenres } = useApiMutation({
    apiFn: async (data: Record<number, string>) => {
      // This is a simplified approach — the real API handles individual CRUD
      return { message: '题材字典已更新' };
    },
    successMessage: '题材字典已更新',
  });

  const handleAddGenre = async () => {
    if (!newGenre.trim()) return;
    try {
      await createGenre(newGenre.trim());
      showToast(`题材「${newGenre.trim()}」已添加`);
      setNewGenre('');
      refreshGenres();
    } catch (err: any) {
      showToast(err.message || '添加失败', 'error');
    }
  };

  const handleDeleteGenre = async (id: number) => {
    try {
      await deleteGenre(id);
      showToast('题材已删除');
      refreshGenres();
    } catch (err: any) {
      showToast(err.message || '删除失败', 'error');
    }
  };

  // ====== Export handlers ======
  const handleExport = async (type: 'payments' | 'inventory' | 'audit') => {
    setExporting(type);
    try {
      const fn = type === 'payments' ? exportPayments : type === 'inventory' ? exportInventory : exportAuditLogs;
      await fn(exportFrom, exportTo);
      showToast('导出成功');
    } catch (err: any) {
      showToast(err.message || '导出失败', 'error');
    } finally {
      setExporting(null);
    }
  };

  // ====== Audit logs ======
  const { data: auditData, loading: auditLoading } = useDataFetch({
    fetcher: (_signal: AbortSignal) => getAuditLogs({ limit: '50' }),
  });

  const auditLogs = auditData?.records ?? [];

  const filteredAuditLogs = auditLogs.filter((log: any) => {
    if (auditFilter.action && log.Action_Type !== auditFilter.action) return false;
    if (auditFilter.entity && log.Target_Entity !== auditFilter.entity) return false;
    if (auditFilter.operator && String(log.Operator_User_ID) !== auditFilter.operator) return false;
    return true;
  });

  const getOperatorName = (id: number) => {
    return `用户#${id}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">系统配置</h2>
          <p className="text-sm text-gray-400 mt-0.5">门店信息 · 审计日志 · 数据管理</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {([
          { key: 'store' as const, label: '门店配置' },
          { key: 'lookup' as const, label: '字典管理' },
          { key: 'audit' as const, label: '审计日志' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              tab === t.key ? 'bg-white text-primary shadow-sm' : 'text-gray-500'
            }`}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'store' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 max-w-lg space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">门店信息</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">门店名称</label>
            <input type="text" value={localStoreInfo.name} onChange={e => setLocalStoreInfo({ ...localStoreInfo, name: e.target.value })} className="input-field text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">地址</label>
            <input type="text" value={localStoreInfo.address} onChange={e => setLocalStoreInfo({ ...localStoreInfo, address: e.target.value })} className="input-field text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">联系电话</label>
              <input type="text" value={localStoreInfo.phone} onChange={e => setLocalStoreInfo({ ...localStoreInfo, phone: e.target.value })} className="input-field text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
              <input type="text" value={localStoreInfo.email} onChange={e => setLocalStoreInfo({ ...localStoreInfo, email: e.target.value })} className="input-field text-sm" />
            </div>
          </div>
          <button
            onClick={() => handleSaveStoreInfo(localStoreInfo)}
            disabled={savingStore}
            className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50"
          >
            {savingStore ? '保存中...' : '保存配置'}
          </button>

          <hr className="border-gray-100" />

          <h3 className="text-lg font-semibold text-gray-800">数据导出</h3>
          <p className="text-xs text-gray-400">选择时间范围，导出 CSV 报表</p>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm text-gray-600">
              从 <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)} className="input-field text-sm w-36 ml-1" />
            </label>
            <label className="text-sm text-gray-600">
              到 <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)} className="input-field text-sm w-36 ml-1" />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => handleExport('payments')} disabled={exporting !== null}
              className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-50">
              {exporting === 'payments' ? '⏳ 导出中...' : '📥 导出支付报表'}
            </button>
            <button onClick={() => handleExport('inventory')} disabled={exporting !== null}
              className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-50">
              {exporting === 'inventory' ? '⏳ 导出中...' : '📥 导出库存报表'}
            </button>
            <button onClick={() => handleExport('audit')} disabled={exporting !== null}
              className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-50">
              {exporting === 'audit' ? '⏳ 导出中...' : '📥 导出审计日志'}
            </button>
          </div>
        </div>
      )}

      {tab === 'lookup' && (
        <div className="space-y-4 max-w-lg">
          {/* Genre management */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">题材标签管理</h3>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newGenre}
                onChange={e => setNewGenre(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddGenre(); }}
                placeholder="新题材名称"
                className="input-field text-sm flex-1"
              />
              <button
                onClick={handleAddGenre}
                className="btn-primary text-sm px-3 py-1.5"
              >添加</button>
            </div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex flex-wrap gap-2">
                {Object.entries(genresMap).map(([id, name]) => (
                  <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-full text-xs text-gray-600">
                    ID:{id} · {name}
                    <button onClick={() => handleDeleteGenre(Number(id))} className="text-[12px] text-red-400 hover:text-red-500 ml-0.5">✕</button>
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => refreshGenres()}
              className="btn-secondary text-sm px-3 py-1.5"
            >刷新题材字典</button>
          </div>

          {/* Role management (read-only) */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">角色定义</h3>
            <div className="space-y-2">
              {[
                { id: 1, name: 'Player', label: '玩家' },
                { id: 2, name: 'DM', label: 'DM主持人' },
                { id: 3, name: 'Admin', label: '店长' },
              ].map(role => (
                <div key={role.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-b-0">
                  <span className="text-sm text-gray-700">{role.label}</span>
                  <span className="text-xs text-gray-400">ID:{role.id} ({role.name})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="space-y-4">
          {/* Audit filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <select value={auditFilter.action} onChange={e => setAuditFilter({ ...auditFilter, action: e.target.value })} className="input-field text-xs py-1 w-40">
              <option value="">全部操作类型</option>
              {ACTION_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={auditFilter.entity} onChange={e => setAuditFilter({ ...auditFilter, entity: e.target.value })} className="input-field text-xs py-1 w-44">
              <option value="">全部目标实体</option>
              {['Fact_Session_Schedule', 'Payment_Transaction_Table', 'Dim_Inventory_Item', 'DM_Shift_Availability_Table', 'Account_Base_Table'].map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
            <select value={auditFilter.operator} onChange={e => setAuditFilter({ ...auditFilter, operator: e.target.value })} className="input-field text-xs py-1 w-36">
              <option value="">全部操作人</option>
            </select>
            <span className="text-xs text-gray-400">{filteredAuditLogs.length} 条记录</span>
          </div>

          {/* Audit log table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">ID</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">时间</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">操作人</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">操作类型</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">目标实体</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">目标记录</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">操作详情</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuditLogs.map((log: any) => (
                  <tr key={log.Audit_ID} className="border-b border-gray-50 hover:bg-gray-50/30">
                    <td className="px-4 py-2 text-gray-400 font-mono text-xs">{log.Audit_ID}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{new Date(log.Logged_At).toLocaleString('zh-CN')}</td>
                    <td className="px-4 py-2 text-gray-700">{getOperatorName(log.Operator_User_ID)}</td>
                    <td className="px-4 py-2">
                      <span className={`text-[12px] px-1.5 py-0.5 rounded ${
                        log.Action_Type.includes('CANCEL') || log.Action_Type.includes('ISSUE_REFUND')
                          ? 'bg-red-50 text-red-600'
                          : log.Action_Type.includes('CREATE')
                          ? 'bg-green-50 text-green-600'
                          : 'bg-blue-50 text-blue-600'
                      }`}>{log.Action_Type}</span>
                    </td>
                    <td className="px-4 py-2 text-gray-500 font-mono text-[11px]">{log.Target_Entity}</td>
                    <td className="px-4 py-2 text-gray-500 font-mono text-xs">#{log.Target_Record_ID}</td>
                    <td className="px-4 py-2 text-gray-400 text-[12px] max-w-[200px] truncate">{log.Action_Details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

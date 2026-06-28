import React, { useEffect, useState, useCallback } from 'react';
import { useDataFetch } from '../../hooks/useDataFetch';
import { getAuditLogs, getAuditStats, type AuditLog, type AuditStats } from '../../api/audit';
import { Loading } from '../../components/common/Loading';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';

/** 操作类型中文映射 */
const ACTION_MAP: Record<string, string> = {
  CREATE_SESSION: '创建场次',
  CANCEL_SESSION: '取消场次',
  LOCK_SESSION: '锁定场次',
  START_SESSION: '开始场次',
  COMPLETE_SESSION: '完成场次',
  ABORT_SESSION: '中止场次',
  UPDATE_SESSION: '更新场次',
  JOIN_SESSION: '玩家参团',
  LEAVE_SESSION: '玩家退团',
  ISSUE_REFUND: '退款处理',
  CREATE_PAYMENT: '支付记账',
  STOCK_IN: '商品入库',
  STOCK_DAMAGE: '商品报损',
  INVENTORY_ADJUST: '库存调整',
  ISSUE_COUPON: '发放优惠券',
  REDEEM_COUPON: '核销优惠券',
  SEND_NOTIFICATION: '发送通知',
  UPDATE_STORE: '更新门店',
  UPDATE_ACCOUNT: '更新账户',
  LOGIN: '用户登录',
  REGISTER: '用户注册',
};

/** 实体中文映射 */
const ENTITY_MAP: Record<string, string> = {
  Fact_Session_Schedule: '场次调度',
  Bridge_Player_Registration: '参团登记',
  Payment_Transaction_Table: '支付交易',
  Dim_Inventory_Item: '库存商品',
  Inventory_Movement_Ledger: '库存流水',
  Fact_Session_Consumption: '场次消费',
  User_Coupon_Instance: '优惠券实例',
  Fact_Session_Review: '服务评价',
  User_Notification: '消息通知',
  Dim_Store_Info: '门店信息',
  Account_Base_Table: '用户账户',
};

function formatAction(action: string): string {
  return ACTION_MAP[action] || action;
}

function formatEntity(entity: string): string {
  return ENTITY_MAP[entity] || entity;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** 尝试解析 JSON 详情 */
function parseDetails(details: string | null): string {
  if (!details) return '—';
  try {
    const obj = JSON.parse(details);
    return JSON.stringify(obj, null, 2);
  } catch {
    return details.length > 200 ? details.slice(0, 200) + '...' : details;
  }
}

// ==================== 审计日志表格 ====================

const AuditLogTable: React.FC = () => {
  const [page, setPage] = useState(1);
  const [filters] = useState<Record<string, string>>({});
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const queryParams: Record<string, string> = { page: String(page), size: '30' };
  if (actionFilter) queryParams['action'] = actionFilter;
  if (entityFilter) queryParams['entity'] = entityFilter;

  const fetcher = useCallback(
    (signal: AbortSignal) => getAuditLogs(queryParams),
    [page, actionFilter, entityFilter]
  );

  const { data, loading, error, refresh } = useDataFetch({
    fetcher,
  });

  const logs: AuditLog[] = data?.records ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 30);

  return (
    <div>
      {/* 筛选栏 */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(1); }}
          className="input-field text-sm w-44"
        >
          <option value="">全部操作类型</option>
          {Object.entries(ACTION_MAP).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          value={entityFilter}
          onChange={e => { setEntityFilter(e.target.value); setPage(1); }}
          className="input-field text-sm w-44"
        >
          <option value="">全部目标实体</option>
          {Object.entries(ENTITY_MAP).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <button
          onClick={() => { setActionFilter(''); setEntityFilter(''); setPage(1); }}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          清除筛选
        </button>
        <span className="ml-auto text-sm text-gray-400 self-center">
          共 {total} 条记录
        </span>
      </div>

      {loading && <Loading text="加载审计日志..." />}
      {error && <ErrorState message="加载审计日志失败" onRetry={refresh} />}
      {!loading && !error && logs.length === 0 && (
        <EmptyState title="暂无审计日志" description="系统操作记录将显示在这里" />
      )}

      {!loading && !error && logs.length > 0 && (
        <>
          {/* 桌面表格 */}
          <div className="hidden md:block overflow-x-auto bg-white rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">时间</th>
                  <th className="px-4 py-3 text-left">操作者</th>
                  <th className="px-4 py-3 text-left">操作类型</th>
                  <th className="px-4 py-3 text-left">目标实体</th>
                  <th className="px-4 py-3 text-left">记录ID</th>
                  <th className="px-4 py-3 text-left">详情</th>
                  <th className="px-4 py-3 text-left">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map(log => (
                  <tr key={log.Audit_ID} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 font-mono text-xs">
                      {formatTime(log.Logged_At)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium">
                      {log.Operator_Name || `用户#${log.Operator_User_ID}`}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        log.Action_Type?.includes('CREATE') ? 'bg-green-50 text-green-700' :
                        log.Action_Type?.includes('CANCEL') || log.Action_Type?.includes('ABORT') ? 'bg-red-50 text-red-700' :
                        log.Action_Type?.includes('DELETE') ? 'bg-red-50 text-red-700' :
                        log.Action_Type?.includes('UPDATE') ? 'bg-blue-50 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {formatAction(log.Action_Type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                      {formatEntity(log.Target_Entity)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-gray-400">
                      {log.Target_Record_ID}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <details className="text-xs">
                        <summary className="text-gray-400 cursor-pointer hover:text-gray-600">
                          查看详情
                        </summary>
                        <pre className="mt-1 p-2 bg-gray-50 rounded text-xs max-h-32 overflow-auto whitespace-pre-wrap">
                          {parseDetails(log.Action_Details)}
                        </pre>
                      </details>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-gray-400">
                      {log.Client_IP || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 移动端卡片 */}
          <div className="md:hidden space-y-3">
            {logs.map(log => (
              <div key={log.Audit_ID} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    log.Action_Type?.includes('CREATE') ? 'bg-green-50 text-green-700' :
                    log.Action_Type?.includes('CANCEL') || log.Action_Type?.includes('ABORT') ? 'bg-red-50 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {formatAction(log.Action_Type)}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">{formatTime(log.Logged_At)}</span>
                </div>
                <p className="text-sm font-medium">{log.Operator_Name || `用户#${log.Operator_User_ID}`}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatEntity(log.Target_Entity)} → #{log.Target_Record_ID}
                </p>
              </div>
            ))}
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50"
              >
                上一页
              </button>
              <span className="text-sm text-gray-500">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ==================== 审计统计面板 ====================

const AuditStatsPanel: React.FC = () => {
  const fetcher = useCallback((signal: AbortSignal) => getAuditStats(), []);

  const { data, loading, error } = useDataFetch({
    fetcher,
  });

  if (loading) return <Loading text="加载统计..." />;
  if (error || !data) return null;

  const stats = data as AuditStats;
  const maxAction = Math.max(1, ...stats.byAction.map(a => a.Count));
  const maxEntity = Math.max(1, ...stats.byEntity.map(e => e.Count));

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {/* 概览卡片 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <p className="text-xs text-gray-400 mb-1">总记录数</p>
        <p className="text-2xl font-bold text-primary">{stats.overview.Total.toLocaleString()}</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <p className="text-xs text-gray-400 mb-1">活跃操作者</p>
        <p className="text-2xl font-bold text-green-600">{stats.overview.ActiveOperators}</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <p className="text-xs text-gray-400 mb-1">操作类型</p>
        <p className="text-2xl font-bold text-purple-600">{stats.overview.ActionTypes}</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <p className="text-xs text-gray-400 mb-1">目标实体</p>
        <p className="text-2xl font-bold text-orange-600">{stats.overview.EntityTypes}</p>
      </div>

      {/* 操作类型分布 */}
      <div className="md:col-span-2 bg-white rounded-xl border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">操作类型分布 (近30天)</h3>
        {stats.byAction.length === 0 ? (
          <p className="text-sm text-gray-400">暂无数据</p>
        ) : (
          <div className="space-y-2">
            {stats.byAction.slice(0, 10).map(a => (
              <div key={a.Action_Type} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-24 truncate">{formatAction(a.Action_Type)}</span>
                <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-400 rounded-full transition-all"
                    style={{ width: `${(a.Count / maxAction) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-gray-500 w-10 text-right">{a.Count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 目标实体分布 */}
      <div className="md:col-span-2 bg-white rounded-xl border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">目标实体分布 (近30天)</h3>
        {stats.byEntity.length === 0 ? (
          <p className="text-sm text-gray-400">暂无数据</p>
        ) : (
          <div className="space-y-2">
            {stats.byEntity.slice(0, 10).map(e => (
              <div key={e.Target_Entity} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-24 truncate">{formatEntity(e.Target_Entity)}</span>
                <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full transition-all"
                    style={{ width: `${(e.Count / maxEntity) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-gray-500 w-10 text-right">{e.Count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 操作者排行 */}
      {stats.topOperators.length > 0 && (
        <div className="md:col-span-4 bg-white rounded-xl border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">操作者排行 Top 10 (近30天)</h3>
          <div className="flex flex-wrap gap-2">
            {stats.topOperators.map((op, idx) => (
              <span key={op.Operator_User_ID}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium ${
                  idx === 0 ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                  idx === 1 ? 'bg-gray-100 text-gray-600 border border-gray-200' :
                  idx === 2 ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                  'bg-gray-50 text-gray-500'
                }`}
              >
                {idx < 3 && <span>{['🥇','🥈','🥉'][idx]}</span>}
                {op.Account_Name || `用户#${op.Operator_User_ID}`}
                <span className="font-mono">({op.Count})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== 主页面 ====================

const AdminAuditPage: React.FC = () => {
  const [tab, setTab] = useState<'logs' | 'stats'>('logs');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">📋 审计日志</h2>
          <p className="text-sm text-gray-400 mt-1">系统操作追踪与安全审计</p>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setTab('logs')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              tab === 'logs' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            日志列表
          </button>
          <button
            onClick={() => setTab('stats')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              tab === 'stats' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            统计分析
          </button>
        </div>
      </div>

      {tab === 'stats' && <AuditStatsPanel />}
      {tab === 'logs' && <AuditLogTable />}
    </div>
  );
};

export default AdminAuditPage;

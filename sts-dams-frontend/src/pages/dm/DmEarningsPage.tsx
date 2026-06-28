import React from 'react';
import { getCurrentUser } from '../../store/auth';
import { getDMEarnings } from '../../api/earnings';
import { useDataFetch } from '../../hooks/useDataFetch';
import { Loading } from '../../components/common/Loading';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import type { DMEarnings } from '../../api/earnings';

export const DmEarningsPage: React.FC = () => {
  const user = getCurrentUser();
  const dmId = user?.DM_User_ID || 0;

  const { data, loading, error, refresh } = useDataFetch<DMEarnings | null>({
    fetcher: (_signal) => (dmId > 0 ? getDMEarnings(dmId) : Promise.resolve(null)),
    deps: [dmId],
  });

  if (loading) return <Loading text="加载收益数据..." />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!data || data.Total_Sessions === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">收益汇总</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {user?.DM_Stage_Name || ''} · 暂无带场数据
          </p>
        </div>
        <EmptyState icon="📊" title="暂无收益数据" description="完成带场后，收益汇总将自动生成。请前往「我的带场」开始或完成场次。" />
      </div>
    );
  }

  const earnings = data;
  const totalSessions = earnings.Total_Sessions;
  const completedCount = earnings.Completed_Sessions;
  const completedRevenue = earnings.Completed_Revenue;
  const estimatedRevenue = earnings.Estimated_Revenue;
  const avgRevenue = earnings.Avg_Per_Session_Revenue;

  const monthlyData = Object.entries(earnings.Monthly_Data).sort((a, b) => b[0].localeCompare(a[0]));
  const maxRevenue = Math.max(...monthlyData.map(([, d]) => d.revenue), 1);

  const completed = earnings.Sessions.filter(s => s.Session_Status === 'Completed');
  const inProgress = earnings.Sessions.filter(s => s.Session_Status === 'In_Progress');

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">收益汇总</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          {user?.DM_Stage_Name} · {totalSessions} 场次 · {completedCount} 场已完成
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '总场次', value: totalSessions, unit: '场', color: 'text-purple-600' },
          { label: '已完成', value: completedCount, unit: '场', color: 'text-green-600' },
          { label: '已完成收入', value: `¥${completedRevenue.toLocaleString()}`, unit: '', color: 'text-accent-pink' },
          { label: '场均收入', value: `¥${avgRevenue.toLocaleString()}`, unit: '', color: 'text-blue-600' },
        ].map(card => (
          <div key={card.label} className="card text-center">
            <div className={`text-2xl font-bold ${card.color}`}>{String(card.value)}</div>
            <div className="text-xs text-gray-400 mt-1">{card.label}{card.unit ? ` (${card.unit})` : ''}</div>
          </div>
        ))}
      </div>

      {/* 预估收入（含进行中场次） */}
      {inProgress.length > 0 && (
        <div className="card bg-gradient-to-r from-blue-50 to-purple-50 border-blue-100">
          <div className="text-xs text-gray-500 mb-1">预估总收入（含进行中）</div>
          <div className="text-xl font-bold text-accent-pink">¥{estimatedRevenue.toLocaleString()}</div>
        </div>
      )}

      {/* 月收入柱状图 */}
      {monthlyData.length > 0 ? (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm">月度收入</h3>
          <div className="space-y-3">
            {monthlyData.map(([month, d]) => (
              <div key={month} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-16 flex-shrink-0">{month}</span>
                <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-purple rounded-full transition-all flex items-center justify-end pr-2"
                    style={{ width: `${(d.revenue / maxRevenue) * 100}%`, minWidth: d.revenue > 0 ? '40px' : '0' }}
                  >
                    <span className="text-[12px] text-white font-medium">¥{d.revenue.toLocaleString()}</span>
                  </div>
                </div>
                <span className="text-xs text-gray-400 w-10 flex-shrink-0 text-right">{d.count}场</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState icon="📊" title="暂无已完成场次" description="完成带场后，收益数据将显示在这里" />
      )}

      {/* 场次明细 */}
      {(completed.length > 0 || inProgress.length > 0) && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 text-sm">场次明细</h3>
          <div className="space-y-2">
            {[...completed, ...inProgress].sort((a, b) => b.Scheduled_Start_Time.localeCompare(a.Scheduled_Start_Time)).map(s => {
              const count = s.Registered_Count > 0 ? s.Registered_Count : 0;
              const revenue = (s.Frozen_Per_Head_Price || 0) * count;
              return (
                <div key={s.Session_ID} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        s.Session_Status === 'Completed' ? 'bg-green-500' : 'bg-blue-500'
                      }`} />
                      <span className="text-sm font-medium text-gray-800 truncate">{s.Script_Title}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 ml-3.5">
                      {s.Scheduled_Start_Time.slice(0, 10)} · {s.Registered_Count || count}人参团 · {s.Room_Name}
                      {s.Session_Status === 'In_Progress' && (
                        <span className="text-blue-500 ml-1">· 进行中</span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-accent-pink flex-shrink-0 ml-4">
                    ¥{revenue.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

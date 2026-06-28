import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, clearAuth } from '../../store/auth';
import { formatDateTime } from '../../utils/format';
import { getSessions } from '../../api/sessions';
import { getSessionConsumptions } from '../../api/consumptions';
import { getMyProfile, getPointsLedger } from '../../api/membership';
import { getMyPayments } from '../../api/payments';
import { showToast } from '../../components/common/Toast';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { PointsBadge } from '../../components/common/PointsBadge';
import { useDataFetch } from '../../hooks/useDataFetch';
import { LEVEL_NAMES, PAYMENT_STATUS_LABEL } from '../../constants/maps';
import type { Session, SessionConsumption, MemberProfile, PointsLedgerEntry, PaymentTransaction } from '../../types';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [showLogout, setShowLogout] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'consumption' | 'stats' | 'membership' | 'payments'>('history');
  const [ledgerFilter, setLedgerFilter] = useState('全部');

  // ===== 数据加载 =====
  const { data: apiSessions } = useDataFetch({
    fetcher: (_signal) => getSessions({ player_id: String(user?.User_ID || 0) }),
  });

  const { data: apiConsumptions } = useDataFetch({
    fetcher: (_signal) => getSessionConsumptions(user?.User_ID || 0),
  });

  const { data: memberProfileData } = useDataFetch({
    fetcher: (_signal) => getMyProfile(),
  });

  const { data: apiPointsLedger } = useDataFetch({
    fetcher: (_signal) => user ? getPointsLedger(user.User_ID) : Promise.resolve([]),
  });

  const { data: apiPayments } = useDataFetch({
    fetcher: (_signal) => user ? getMyPayments(user.User_ID) : Promise.resolve([]),
  });

  const memberProfile = memberProfileData;
  const pointsLedger = apiPointsLedger || [];
  const payments: PaymentTransaction[] = apiPayments || [];

  if (!user) {
    return (
      <div className="py-16 text-center text-gray-400">
        <p>请先登录</p>
        <button onClick={() => navigate('/login')} className="btn-primary mt-4 text-sm">去登录</button>
      </div>
    );
  }

  const sessions = (apiSessions && apiSessions.length > 0) ? apiSessions : [];
  const consumptions = (apiConsumptions && apiConsumptions.length > 0) ? apiConsumptions : [];

  // 统计数据：使用 API 数据
  const totalSessions = sessions.length;
  const totalScriptSpend = sessions.reduce((sum, s) => sum + (s.Frozen_Per_Head_Price || 0), 0);
  const totalConsumptionSpend = consumptions.reduce((sum, c) => sum + (c.Line_Total_Cost || 0), 0);
  const avgSpend = totalSessions > 0
    ? (totalScriptSpend + totalConsumptionSpend) / totalSessions
    : 0;

  const handleLogout = () => {
    clearAuth();
    navigate('/login', { replace: true });
    showToast('已退出登录');
  };

  const roleTypeLabel = user.Role_Type === 2 ? 'DM' : user.Role_Type === 3 ? '店长' : '玩家';

  return (
    <div className="py-4 space-y-4">
      {/* 用户信息卡片 */}
      <div className="card">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
            {user.Account_Name[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{user.Account_Name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="badge bg-purple-100 text-purple-600">{roleTypeLabel}</span>
              {user.DM_Stage_Name && (
                <span className="badge bg-orange-100 text-orange-600">{user.DM_Stage_Name}</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowLogout(true)}
            className="text-xs text-gray-400 px-3 py-1.5 rounded-lg border border-gray-200"
          >
            退出
          </button>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {([
          { key: 'history' as const, label: '参团历史' },
          { key: 'consumption' as const, label: '消费明细' },
          { key: 'payments' as const, label: '支付记录' },
          { key: 'stats' as const, label: '数据统计' },
          { key: 'membership' as const, label: '我的会员' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key ? 'bg-white text-primary shadow-sm' : 'text-gray-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 参团历史 */}
      {activeTab === 'history' && (
        <div className="space-y-2">
          {sessions.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">暂无参团记录</p>
          ) : (
            sessions.map(s => (
              <div key={s.Session_ID} className="card flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-sm text-gray-900 truncate">{s.Script_Title}</h4>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {s.Scheduled_Start_Time && (
                      <>
                        <span>{formatDateTime(s.Scheduled_Start_Time)}</span>
                        <span className="mx-1">·</span>
                      </>
                    )}
                    <span>{s.Room_Name}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <span className="text-sm font-semibold text-accent-pink">¥{s.Frozen_Per_Head_Price}</span>
                  <div className="badge text-[12px] mt-0.5 bg-gray-100 text-gray-500">
                    {s.Session_Status}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 消费明细 */}
      {activeTab === 'consumption' && (
        <div className="space-y-2">
          {consumptions.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">暂无消费记录</p>
          ) : (
            consumptions.map(c => (
              <div key={c.Consumption_ID} className="card">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm text-gray-900">{c.Item_Name}</span>
                  <span className="text-sm font-semibold text-gray-900">¥{c.Line_Total_Cost.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{c.Consumed_Quantity} 件 × ¥{c.Unit_Price_At_Sale}</span>
                  <span>{sessions.find(s => s.Session_ID === c.Session_ID)?.Script_Title || '未知场次'}</span>
                </div>
                <div className="text-[12px] text-gray-400 mt-0.5">
                  {formatDateTime(c.Recorded_At)}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 支付记录 */}
      {activeTab === 'payments' && (
        <div className="space-y-2">
          {payments.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">暂无支付记录</p>
          ) : (
            payments.map(p => (
              <div key={`pay-${p.Transaction_ID}`} className="card flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-sm text-gray-900 truncate">
                    {PAYMENT_STATUS_LABEL[p.Payment_Method] || p.Payment_Method} · {p.Transaction_Type}
                  </h4>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {p.Remarks && <span>{p.Remarks}</span>}
                    {!p.Remarks && <span>{formatDateTime(p.Processed_At)}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <span className={`text-sm font-semibold ${p.Amount >= 0 ? 'text-accent-pink' : 'text-green-600'}`}>
                    {p.Amount >= 0 ? '-' : '+'}¥{Math.abs(p.Amount)}
                  </span>
                  <div className="badge text-[12px] mt-0.5 bg-gray-100 text-gray-500">
                    {p.Transaction_Type}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 数据统计 */}
      {activeTab === 'stats' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card text-center">
              <p className="text-2xl font-bold text-primary">{totalSessions}</p>
              <p className="text-xs text-gray-400 mt-1">累计参团场次</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-accent-pink">¥{avgSpend.toFixed(0)}</p>
              <p className="text-xs text-gray-400 mt-1">平均客单价</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-accent-purple">¥{totalScriptSpend.toFixed(0)}</p>
              <p className="text-xs text-gray-400 mt-1">剧本累计消费</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-orange-500">¥{totalConsumptionSpend.toFixed(0)}</p>
              <p className="text-xs text-gray-400 mt-1">商品累计消费</p>
            </div>
          </div>

        </div>
      )}

      {/* 会员积分 */}
      {activeTab === 'membership' && (
        <div className="space-y-3">
          {memberProfile ? (
            <>
              {/* 等级徽章与积分 */}
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">会员等级</h3>
                  <PointsBadge level={memberProfile.Level_Name || 'Bronze'} points={memberProfile.Accumulated_Points} size="lg" />
                </div>

                {/* 升级进度条 */}
                {memberProfile.Next_Level && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>距下一级 ({(LEVEL_NAMES[memberProfile.Next_Level.Level_Name] || memberProfile.Next_Level.Level_Name)}) 还需</span>
                      <span className="font-medium">{memberProfile.Next_Level.Min_Required_Points - memberProfile.Accumulated_Points} 分</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-500 h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (memberProfile.Accumulated_Points / memberProfile.Next_Level.Min_Required_Points) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[12px] text-gray-400">
                      <span>{memberProfile.Accumulated_Points} 分</span>
                      <span>{memberProfile.Next_Level.Min_Required_Points} 分</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100">
                  <div className="text-center">
                    <p className="text-lg font-bold text-primary">{memberProfile.Total_Lifetime_Points.toLocaleString()}</p>
                    <p className="text-[12px] text-gray-400">累计获取</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-accent-purple">
                      {memberProfile.Discount_Rate ? `${(memberProfile.Discount_Rate * 100).toFixed(0)}折` : '-'}
                    </p>
                    <p className="text-[12px] text-gray-400">等级折扣</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-accent-pink">
                      {memberProfile.Point_Earning_Multiplier ? `${memberProfile.Point_Earning_Multiplier.toFixed(2)}×` : '-'}
                    </p>
                    <p className="text-[12px] text-gray-400">积分倍率</p>
                  </div>
                </div>
              </div>

              {/* 积分等级对照表 */}
              <div className="card">
                <h3 className="font-semibold text-sm text-gray-900 mb-2">等级权益</h3>
                <div className="space-y-1">
                  {(() => {
                    // 使用离线统计数据中的会员等级（从 mockMemberLevels）
                    const levels = memberProfile?.All_Levels || [];
                    return levels.length > 0 ? levels.map(ml => (
                      <div key={ml.Level_ID}
                        className={`flex items-center justify-between text-xs py-1.5 px-2 rounded ${
                          ml.Level_ID === memberProfile.Current_Level_ID ? 'bg-purple-50' : ''
                        }`}>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${ml.Level_ID === memberProfile.Current_Level_ID ? 'bg-purple-500' : 'bg-gray-300'}`} />
                          <span>{LEVEL_NAMES[ml.Level_Name] || ml.Level_Name}</span>
                        </div>
                        <span className="text-gray-400">
                          {ml.Min_Required_Points.toLocaleString()} 分 · {(ml.Discount_Rate * 100).toFixed(0)}折 · {ml.Point_Earning_Multiplier.toFixed(2)}×
                        </span>
                      </div>
                    )) : null;
                  })()}
                </div>
              </div>

              {/* 积分流水 */}
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm text-gray-900">积分流水</h3>
                  <div className="flex gap-1">
                    {['全部', '获取', '消费'].map(f => (
                      <button key={f}
                        onClick={() => setLedgerFilter(f)}
                        className={`text-[12px] px-2 py-0.5 rounded ${ledgerFilter === f ? 'bg-purple-100 text-purple-600' : 'text-gray-400'}`}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {pointsLedger.filter((e: PointsLedgerEntry) => {
                    if (ledgerFilter === '获取') return e.Points_Delta > 0;
                    if (ledgerFilter === '消费') return e.Points_Delta < 0;
                    return true;
                  }).map((entry: PointsLedgerEntry) => (
                    <div key={entry.Ledger_ID} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-700 truncate">{entry.Remarks || ({
                          Earn_Session: '场次完成奖励', Earn_Consumption: '消费积分', Earn_Manual: '手动调整',
                          Redeem_Cash: '积分兑换抵扣', Redeem_Gift: '积分兑换礼品', Expire: '积分过期', Adjust: '积分调整',
                        }[entry.Transaction_Type] || entry.Transaction_Type)}</p>
                        <p className="text-[12px] text-gray-400">{formatDateTime(entry.Created_At)}</p>
                      </div>
                      <span className={`text-sm font-medium ml-2 ${entry.Points_Delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {entry.Points_Delta > 0 ? '+' : ''}{entry.Points_Delta}
                      </span>
                    </div>
                  ))}
                  {pointsLedger.length === 0 && (
                    <p className="text-center text-gray-400 text-xs py-4">暂无积分流水</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="card text-center py-8 text-gray-400 text-sm">加载会员信息中...</div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={showLogout}
        title="退出登录"
        message="确定要退出登录吗？"
        confirmText="退出"
        danger
        onConfirm={handleLogout}
        onCancel={() => setShowLogout(false)}
      />
    </div>
  );
};

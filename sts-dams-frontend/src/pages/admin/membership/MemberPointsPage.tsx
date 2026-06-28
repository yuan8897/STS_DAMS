import React, { useState, useEffect } from 'react';
import { formatDateTime } from '../../../utils/format';
import { LEVEL_NAMES } from '../../../constants/maps';
import { getUserPoints, getPointsLedger, manualPoints } from '../../../api/membership';
import { getAccounts } from '../../../api/accounts';
import { PointsBadge } from '../../../components/common/PointsBadge';
import { showToast } from '../../../components/common/Toast';
import { useDataFetch } from '../../../hooks/useDataFetch';
import { useApiMutation } from '../../../hooks/useApiMutation';
import type { MemberProfile, PointsLedgerEntry, Account } from '../../../types';

export const MemberPointsPage: React.FC = () => {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [showAdjust, setShowAdjust] = useState(false);
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState('');

  // Fetch player accounts
  const { data: playersData = [] } = useDataFetch<Account[]>({
    fetcher: (_signal: AbortSignal) => getAccounts({ role: 1 }),
  });
  const players = playersData || [];

  // ====== Profile data fetch (re-fetches when selectedUserId changes) ======
  const { data: profile, refresh: refreshProfile } = useDataFetch<MemberProfile | null>({
    fetcher: (_signal: AbortSignal) =>
      selectedUserId ? getUserPoints(selectedUserId) : Promise.resolve(null),
  });

  // ====== Ledger data fetch ======
  const { data: ledger = [], refresh: refreshLedger } = useDataFetch<PointsLedgerEntry[]>({
    fetcher: (_signal: AbortSignal) =>
      selectedUserId ? getPointsLedger(selectedUserId) : Promise.resolve([]),
  });

  // Re-fetch when selected user changes
  useEffect(() => {
    if (selectedUserId) {
      refreshProfile();
      refreshLedger();
    }
  }, [selectedUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ====== Adjust mutation ======
  const { execute: doAdjust, loading: adjusting } = useApiMutation({
    apiFn: (params: { userId: number; Points_Delta: number; Remarks?: string }) =>
      manualPoints(params.userId, { Points_Delta: params.Points_Delta, Remarks: params.Remarks }),
    successMessage: (result) => `积分调整成功，新余额：${result.New_Balance}`,
  });

  const handleAdjust = async () => {
    if (!selectedUserId || delta === 0) { showToast('请输入有效变动额', 'error'); return; }
    const result = await doAdjust({ userId: selectedUserId, Points_Delta: delta, Remarks: reason || undefined });
    if (result) {
      setShowAdjust(false); setDelta(0); setReason('');
      refreshProfile();
      refreshLedger();
    }
  };

  return (
    <div className="py-4 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">积分管理</h2>

      {/* 用户选择 */}
      <div className="card">
        <label className="text-sm text-gray-500 block mb-2">选择玩家</label>
        <select className="input-field w-full text-sm" value={selectedUserId || ''}
          onChange={e => setSelectedUserId(Number(e.target.value) || null)}>
          <option value="">-- 选择玩家 --</option>
          {players.map(p => (
            <option key={p.User_ID} value={p.User_ID}>{p.Account_Name}</option>
          ))}
        </select>
      </div>

      {selectedUserId && profile && (
        <>
          {/* 积分概览 */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">用户 #{selectedUserId}</h3>
              <PointsBadge level={profile.Level_Name || 'Bronze'} points={profile.Accumulated_Points} size="md" />
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xl font-bold text-primary">{profile.Accumulated_Points.toLocaleString()}</p>
                <p className="text-[12px] text-gray-400">可用积分</p>
              </div>
              <div>
                <p className="text-xl font-bold text-accent-purple">{profile.Total_Lifetime_Points.toLocaleString()}</p>
                <p className="text-[12px] text-gray-400">累计积分</p>
              </div>
              <div>
                <p className="text-xl font-bold text-accent-pink">{profile.Discount_Rate ? `${(profile.Discount_Rate * 100).toFixed(0)}%` : '-'}</p>
                <p className="text-[12px] text-gray-400">当前折扣</p>
              </div>
            </div>
            <button onClick={() => setShowAdjust(true)} className="btn-primary text-sm w-full mt-3">手动调整积分</button>
          </div>

          {/* 积分流水 */}
          <div className="card">
            <h3 className="font-semibold text-sm text-gray-900 mb-2">积分流水</h3>
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {(ledger || []).map(entry => (
                <div key={entry.Ledger_ID} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-700 truncate">{entry.Remarks || entry.Transaction_Type}</p>
                    <p className="text-[12px] text-gray-400">{formatDateTime(entry.Created_At)}</p>
                  </div>
                  <div className="text-right ml-2">
                    <span className={`text-sm font-medium ${entry.Points_Delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {entry.Points_Delta > 0 ? '+' : ''}{entry.Points_Delta}
                    </span>
                    <p className="text-[12px] text-gray-400">余额: {entry.Points_Balance_After}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 调整弹窗 */}
      {showAdjust && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setShowAdjust(false)}>
          <div className="bg-white rounded-xl p-6 w-[380px] max-w-[90vw] space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900">手动调整积分</h3>
            <div>
              <label className="text-xs text-gray-500">变动额 (正数=增加, 负数=扣减)</label>
              <input type="number" className="input-field w-full mt-1 text-sm" value={delta}
                onChange={e => setDelta(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs text-gray-500">备注</label>
              <input className="input-field w-full mt-1 text-sm" value={reason}
                onChange={e => setReason(e.target.value)} placeholder="如: 活动奖励 / 投诉补偿" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowAdjust(false)} className="btn-secondary flex-1 text-sm">取消</button>
              <button onClick={handleAdjust} disabled={adjusting} className="btn-primary flex-1 text-sm disabled:opacity-50">
                {adjusting ? '调整中...' : '确认调整'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

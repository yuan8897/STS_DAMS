import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { ScriptRole } from '../../types';
import { formatTime, formatDateTime } from '../../utils/format';
import { getSessionDetail, joinSession, leaveSession } from '../../api/sessions';
import { getCurrentUser } from '../../store/auth';
import { showToast } from '../../components/common/Toast';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useDataFetch } from '../../hooks/useDataFetch';
import { useApiMutation } from '../../hooks/useApiMutation';
import { PAYMENT_STATUS_LABEL, PAYMENT_STATUS_COLOR } from '../../constants/maps';

export const SessionDetail: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [showJoinConfirm, setShowJoinConfirm] = useState(false);

  const { data: detail, loading, error, refresh } = useDataFetch({
    fetcher: (_signal) => getSessionDetail(Number(sessionId)),
  });

  const { execute: doJoin, loading: joining } = useApiMutation({
    apiFn: () => joinSession(Number(sessionId)),
    successMessage: '参团成功！请尽快选择角色并完成支付',
  });

  const { execute: doLeave, loading: leaving } = useApiMutation({
    apiFn: () => leaveSession(Number(sessionId)),
    successMessage: '已退团',
  });

  if (loading) {
    return <div className="py-16 text-center text-gray-400">加载中...</div>;
  }

  if (!detail) {
    return (
      <div className="py-16 text-center text-gray-400">
        <p>场次不存在或已取消</p>
        <button onClick={() => navigate('/lobby')} className="btn-primary mt-4 text-sm">返回大厅</button>
      </div>
    );
  }

  const session = detail;
  const allRoles = detail.Roles || [];
  const registrations = detail.Players || [];

  const playerCount = registrations.length;
  const maxPlayers = session.Max_Allowed_Players || 7;
  const myReg = registrations.find(r => r.Player_User_ID === user?.User_ID);
  const hasJoined = !!myReg;

  const handleJoin = async () => {
    const result = await doJoin(undefined as void);
    if (result) {
      refresh();
    }
    setShowJoinConfirm(false);
  };

  const handleLeave = async () => {
    if (!myReg) return;
    const result = await doLeave(undefined as void);
    if (result) {
      refresh();
    }
  };

  const getPaymentBadge = (status: string) => {
    const label = PAYMENT_STATUS_LABEL[status as keyof typeof PAYMENT_STATUS_LABEL] || status;
    const color = PAYMENT_STATUS_COLOR[status as keyof typeof PAYMENT_STATUS_COLOR] || '#888';
    const bgMap: Record<string, string> = {
      '#e04040': 'bg-red-100 text-red-600',
      '#f0a050': 'bg-orange-100 text-orange-600',
      '#50c878': 'bg-green-100 text-green-600',
      '#888888': 'bg-gray-100 text-gray-500',
    };
    return { label, badge: bgMap[color] || 'bg-gray-100 text-gray-500' };
  };

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/lobby')} className="text-gray-400 text-sm flex items-center gap-1 hover:text-gray-600 transition-colors">
        ← 返回大厅
      </button>

      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-start gap-3 mb-3">
              <h2 className="text-2xl font-bold text-gray-900">{session.Script_Title}</h2>
              <span className={`badge text-sm ${
                session.Session_Status === 'Matching' ? 'badge-matching' :
                session.Session_Status === 'Locked_Ready' ? 'badge-locked' :
                session.Session_Status === 'In_Progress' ? 'badge-progress' :
                session.Session_Status === 'Completed' ? 'badge-completed' :
                'badge-aborted'
              }`}>
                {(({ Matching: '拼车中', Locked_Ready: '已锁车', In_Progress: '进行中', Completed: '已结束', Aborted: '已取消' }) as Record<string, string>)[session.Session_Status] || session.Session_Status}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm text-gray-600">
              <div><span className="text-gray-400">时间</span> <span className="ml-2">{formatDateTime(session.Scheduled_Start_Time)} ~ {formatTime(session.Scheduled_End_Time)}</span></div>
              <div><span className="text-gray-400">房间</span> <span className="ml-2">{session.Room_Name}</span></div>
              <div><span className="text-gray-400">DM</span> <span className="ml-2">{session.DM_Stage_Name}</span></div>
              <div><span className="text-gray-400">人数</span> <span className="ml-2">{playerCount}/{maxPlayers}人（最少 {session.Min_Required_Players} 人）</span></div>
              <div><span className="text-gray-400">价格</span> <span className="ml-2 text-lg font-bold text-accent-pink">¥{session.Frozen_Per_Head_Price}/人</span></div>
              <div><span className="text-gray-400">题材</span> <span className="ml-2">{session.Genre_Name || '-'}</span></div>
            </div>
          </div>

          {session.Session_Status === 'Matching' && (
            <div className="flex sm:flex-col gap-2 sm:min-w-[140px]">
              {hasJoined ? (
                <>
                  {!myReg?.Role_ID && (
                    <button onClick={() => navigate(`/lobby/session/${session.Session_ID}/pick-role`)} className="btn-primary text-sm flex-1">
                      选择角色
                    </button>
                  )}
                  <button onClick={handleLeave} disabled={leaving} className="btn-secondary text-sm flex-1">
                    {leaving ? '处理中...' : '退团'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowJoinConfirm(true)}
                  disabled={playerCount >= maxPlayers || joining}
                  className="btn-primary text-sm flex-1"
                >
                  {joining ? '参团中...' : playerCount >= maxPlayers ? '已满员' : '立即参团'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">剧本角色 ({allRoles.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {allRoles.map(role => {
              const occupiedReg = registrations.find((r: any) => r.Role_ID === role.Role_ID);
              const isOccupied = !!occupiedReg;
              const gIcon = role.Gender_Restriction === 'Male' ? '♂️' : role.Gender_Restriction === 'Female' ? '♀️' : '🔄';
              return (
                <div key={role.Role_ID}
                  className={`flex items-center justify-between p-3 rounded-xl ${isOccupied ? 'bg-gray-50' : 'bg-purple-50/30 border border-purple-100'}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base flex-shrink-0">{gIcon}</span>
                    <div className="min-w-0">
                      <span className={`font-medium text-sm truncate block ${isOccupied ? 'text-gray-400' : 'text-gray-900'}`}>{role.Role_Name}</span>
                      {role.Role_Description && <p className="text-[11px] text-gray-400 truncate">{role.Role_Description}</p>}
                    </div>
                  </div>
                  {isOccupied ? <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{occupiedReg.Player_Name || occupiedReg.Account_Name}</span>
                    : <span className="badge bg-green-100 text-green-600 text-[12px] flex-shrink-0">可选</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">已参团玩家 ({playerCount})</h3>
          {registrations.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">暂无玩家参团</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {registrations.map((reg: any) => {
                const pmt = getPaymentBadge(reg.Cached_Payment_Status || 'Unpaid');
                return (
                  <div key={reg.Registration_ID} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary flex-shrink-0">
                        {(reg.Player_Name || reg.Account_Name || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-900">{reg.Player_Name || reg.Account_Name || '?'}</span>
                        {reg.Role_Name && <span className="text-xs text-gray-400 ml-1.5">饰 {reg.Role_Name}</span>}
                      </div>
                    </div>
                    <span className={`badge text-[12px] ${pmt.badge}`}>
                      {pmt.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showJoinConfirm}
        title="确认参团"
        message={`确认参加《${session.Script_Title}》？参团后可选择角色。`}
        confirmText="确认参团"
        onConfirm={handleJoin}
        onCancel={() => setShowJoinConfirm(false)}
      />
    </div>
  );
};

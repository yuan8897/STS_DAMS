import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../../store/auth';
import { formatTime, formatDate } from '../../utils/format';
import { getSessions, updateSessionStatus } from '../../api/sessions';
import { useDataFetch } from '../../hooks/useDataFetch';
import { useApiMutation } from '../../hooks/useApiMutation';
import { SESSION_STATUS_LABEL, SESSION_STATUS_BADGE, SESSION_STATUS_ORDER } from '../../constants/maps';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Loading } from '../../components/common/Loading';
import type { Session, SessionStatus } from '../../types';

export const DmSessionsPage: React.FC = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const dmId = user?.DM_User_ID;
  const { data: sessions, loading, error, refresh } = useDataFetch<Session[]>({
    fetcher: (_signal) => dmId ? getSessions({ dm_id: String(dmId) }) : Promise.resolve([]),
    refreshInterval: 30000,
  });

  const { execute: doStatusChange } = useApiMutation({
    apiFn: (params: { sessionId: number; newStatus: SessionStatus }) =>
      updateSessionStatus(params.sessionId, params.newStatus),
    successMessage: `场次状态已更新`,
  });

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; message: string; session: Session | null; newStatus: SessionStatus | null; danger: boolean;
  }>({ open: false, title: '', message: '', session: null, newStatus: null, danger: false });
  const [cancelReason, setCancelReason] = useState('');

  // Keep abort dialog message in sync with cancelReason edits
  useEffect(() => {
    if (confirmDialog.open && confirmDialog.newStatus === 'Aborted' && confirmDialog.session) {
      setConfirmDialog(prev => ({
        ...prev,
        message: `确定取消《${confirmDialog.session!.Script_Title}》吗？此操作不可撤销。${cancelReason ? `\n取消原因：${cancelReason}` : ''}`,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelReason]);

  const executeStatusChange = async (session: Session, newStatus: SessionStatus) => {
    setActionLoading(session.Session_ID);
    try {
      const result = await doStatusChange({ sessionId: session.Session_ID, newStatus });
      if (result !== null) {
        refresh();
        setConfirmDialog({ open: false, title: '', message: '', session: null, newStatus: null, danger: false });
        setCancelReason('');
      }
    } catch {
      // Error already handled by useApiMutation
    } finally {
      setActionLoading(null);
    }
  };

  const requestStatusChange = (session: Session, newStatus: SessionStatus) => {
    if (newStatus === 'Aborted') {
      setConfirmDialog({
        open: true, danger: true,
        title: '确认取消场次',
        message: `确定取消《${session.Script_Title}》吗？此操作不可撤销。${cancelReason ? `\n取消原因：${cancelReason}` : ''}`,
        session, newStatus,
      });
      return;
    }
    if (newStatus === 'Completed') {
      setConfirmDialog({
        open: true, danger: false,
        title: '确认结账完成',
        message: `确定将《${session.Script_Title}》标记为已完成吗？确认后将无法继续记账。`,
        session, newStatus,
      });
      return;
    }
    // 锁车和开场直接执行
    executeStatusChange(session, newStatus);
  };

  const sessionList = sessions || [];
  const sorted = [...sessionList].sort(
    (a, b) => (SESSION_STATUS_ORDER[a.Session_Status] ?? 9) - (SESSION_STATUS_ORDER[b.Session_Status] ?? 9)
    || new Date(a.Scheduled_Start_Time).getTime() - new Date(b.Scheduled_Start_Time).getTime()
  );

  const filtered = statusFilter === 'all'
    ? sorted
    : sorted.filter(s => s.Session_Status === statusFilter);

  // 统计摘要
  const today = new Date().toDateString();
  const todayList = sessionList.filter(s => new Date(s.Scheduled_Start_Time).toDateString() === today);
  const activeCount = todayList.filter(s => s.Session_Status === 'In_Progress').length;
  const matchingCount = todayList.filter(s => s.Session_Status === 'Matching').length;
  const completedCount = todayList.filter(s => s.Session_Status === 'Completed').length;
  const todayRevenue = todayList
    .filter(s => s.Session_Status === 'Completed' || s.Session_Status === 'In_Progress')
    .reduce((sum, s) => sum + (s.Registered_Count || 0) * (s.Frozen_Per_Head_Price || 0), 0);

  const statusFilters = [
    { key: 'all', label: '全部' },
    { key: 'In_Progress', label: SESSION_STATUS_LABEL.In_Progress },
    { key: 'Matching', label: SESSION_STATUS_LABEL.Matching },
    { key: 'Locked_Ready', label: SESSION_STATUS_LABEL.Locked_Ready },
    { key: 'Completed', label: SESSION_STATUS_LABEL.Completed },
  ];

  if (loading) return <Loading text="加载场次列表..." />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">我的带场</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {user?.DM_Stage_Name} · 今日 {todayList.length} 场
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/lobby')}
            className="text-sm font-medium text-white bg-accent-purple hover:bg-purple-700 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
          >
            🚗 创车
          </button>
          <button
            onClick={refresh}
            className="text-sm text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
          >
            🔄 刷新
          </button>
        </div>
      </div>

      {/* 统计摘要卡片 */}
      {todayList.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: '进行中', value: activeCount, color: 'text-green-600 bg-green-50', icon: '🎪' },
            { label: '拼车中', value: matchingCount, color: 'text-blue-600 bg-blue-50', icon: '🚗' },
            { label: '已完成', value: completedCount, color: 'text-gray-600 bg-gray-50', icon: '✅' },
            { label: '今日预估营收', value: `¥${todayRevenue}`, color: 'text-accent-pink bg-pink-50', icon: '💰' },
          ].map(stat => (
            <div key={stat.label} className={`rounded-xl p-3 sm:p-4 ${stat.color.split(' ')[1]}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{stat.icon}</span>
                <span className="text-xs font-medium text-current opacity-70">{stat.label}</span>
              </div>
              <span className={`text-xl sm:text-2xl font-bold ${stat.color.split(' ')[0]}`}>
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 状态筛选 */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {statusFilters.map(f => {
          const count = f.key === 'all' ? sessionList.length : sessionList.filter(s => s.Session_Status === f.key).length;
          return (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                statusFilter === f.key
                  ? 'bg-accent-purple text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      {/* 场次列表 */}
      {filtered.length === 0 ? (
        <EmptyState icon="🎪" title={statusFilter === 'all' ? '暂无带场安排' : `暂无"${SESSION_STATUS_LABEL[statusFilter as SessionStatus] || statusFilter}"场次`} description="稍后再来看看" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(session => {
            const players = session.Players || [];
            const playerCount = session.Registered_Count || players.length;
            const maxPlayers = session.Max_Allowed_Players || 7;

            const actions: { status: SessionStatus; label: string; className: string; condition: boolean }[] = [
              { status: 'Locked_Ready', label: '🔒 锁车', className: 'bg-orange-500 hover:bg-orange-600', condition: session.Session_Status === 'Matching' },
              { status: 'In_Progress', label: '▶ 开场', className: 'bg-green-500 hover:bg-green-600', condition: session.Session_Status === 'Locked_Ready' },
              { status: 'Completed', label: '✅ 结账', className: 'bg-gray-600 hover:bg-gray-700', condition: session.Session_Status === 'In_Progress' },
              { status: 'Aborted', label: '✕ 取消', className: 'bg-red-500 hover:bg-red-600', condition: session.Session_Status === 'Matching' || session.Session_Status === 'Locked_Ready' },
            ];

            return (
              <div key={session.Session_ID} className="card group">
                {/* 卡片头部 */}
                <div
                  className="cursor-pointer"
                  onClick={() => navigate(`/dm/sessions/${session.Session_ID}`)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate group-hover:text-accent-purple transition-colors">
                        {session.Script_Title}
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(session.Scheduled_Start_Time)} {formatTime(session.Scheduled_Start_Time)} ~ {formatTime(session.Scheduled_End_Time)}
                        <span className="mx-1.5">·</span>
                        {session.Room_Name}
                      </p>
                    </div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${SESSION_STATUS_BADGE[session.Session_Status]}`}>
                      {SESSION_STATUS_LABEL[session.Session_Status]}
                    </span>
                  </div>

                  {/* 参团进度 */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          playerCount >= maxPlayers ? 'bg-red-400' : playerCount >= (session.Min_Required_Players || 0) ? 'bg-accent-purple' : 'bg-orange-300'
                        }`}
                        style={{ width: `${Math.min((playerCount / maxPlayers) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {playerCount}/{maxPlayers}人
                      {playerCount < (session.Min_Required_Players || 0) && (
                        <span className="text-orange-400 ml-1">差{(session.Min_Required_Players || 0) - playerCount}人</span>
                      )}
                    </span>
                  </div>

                  {/* 玩家预览 */}
                  {players.length > 0 && (
                    <div className="flex items-center gap-1.5 mb-3">
                      {players.slice(0, 5).map((r: any) => (
                        <div
                          key={r.Registration_ID}
                          className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[12px] font-medium text-primary"
                          title={r.Player_Name || `U${r.Player_User_ID}`}
                        >
                          {(r.Player_Name || `U${r.Player_User_ID}`)[0].toUpperCase()}
                        </div>
                      ))}
                      {players.length > 5 && (
                        <span className="text-xs text-gray-400 ml-1">+{players.length - 5}</span>
                      )}
                      {players.some((r: any) => !r.Role_ID) && (
                        <span className="text-[12px] text-orange-400 ml-1">有未选角</span>
                      )}
                    </div>
                  )}

                  {/* 底部信息 */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                    <span className="text-sm font-semibold text-accent-pink">¥{session.Frozen_Per_Head_Price}/人</span>
                    <span className="text-xs text-gray-400">
                      {session.Session_Status === 'Matching' && '等待玩家参团'}
                      {session.Session_Status === 'Locked_Ready' && '可点击开场'}
                      {session.Session_Status === 'In_Progress' && '可记账消费'}
                      {session.Session_Status === 'Completed' && '已完成结账'}
                      {session.Session_Status === 'Aborted' && '已取消'}
                    </span>
                  </div>
                </div>

                {/* 快捷操作按钮 */}
                {actions.some(a => a.condition) && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                    {actions.filter(a => a.condition).map(action => (
                      <button
                        key={action.status}
                        onClick={e => {
                          e.stopPropagation();
                          requestStatusChange(session, action.status);
                        }}
                        disabled={actionLoading === session.Session_ID}
                        className={`${action.className} text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex-1`}
                      >
                        {actionLoading === session.Session_ID ? '处理中...' : action.label}
                      </button>
                    ))}
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        navigate(`/dm/sessions/${session.Session_ID}`);
                      }}
                      className="text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                    >
                      详情 →
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 确认弹窗（取消原因已合并到对话框内容区域，消除双层遮罩） */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        danger={confirmDialog.danger}
        confirmText={confirmDialog.newStatus === 'Aborted' ? '确认取消' : '确认'}
        cancelText="返回"
        onConfirm={() => {
          if (confirmDialog.session && confirmDialog.newStatus) {
            executeStatusChange(confirmDialog.session, confirmDialog.newStatus);
          }
        }}
        onCancel={() => {
          setConfirmDialog({ open: false, title: '', message: '', session: null, newStatus: null, danger: false });
          setCancelReason('');
        }}
      >
        {confirmDialog.newStatus === 'Aborted' && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">取消原因（选填）</h4>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="例如：人数不足、玩家临时有事…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none h-20 focus:outline-none focus:border-purple-300"
            />
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
};

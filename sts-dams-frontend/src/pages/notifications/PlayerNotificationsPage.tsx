import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotifications, markRead, markAllRead } from '../../api/notifications';
import { useDataFetch } from '../../hooks/useDataFetch';
import { useApiMutation } from '../../hooks/useApiMutation';
import { Loading } from '../../components/common/Loading';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import type { Notification } from '../../types';

const TYPE_ICON: Record<string, string> = {
  new_session: '🎭',
  session_ready: '✅',
  session_cancelled: '❌',
  inventory_alert: '📦',
  payment_reminder: '💰',
  session_risk: '⚠️',
};

export const PlayerNotificationsPage: React.FC = () => {
  const navigate = useNavigate();

  const { data, loading, error, refresh } = useDataFetch({
    fetcher: async (_signal) => {
      const apiData = await getNotifications();
      // Map API format to frontend Notification format
      return apiData.map((n: any) => ({
        id: n.Notification_ID || n.id,
        type: n.Notification_Type || n.type || 'new_session',
        title: n.Title || n.title,
        message: n.Content || n.message || '',
        read: n.Is_Read ?? n.read ?? false,
        created_at: n.Created_At || n.created_at || new Date().toISOString(),
        link: n.Related_Entity_Type === 'Session' ? `/lobby/session/${n.Related_Entity_ID}` : undefined,
      })) as Notification[];
    },
    refreshInterval: 30000,
  });

  const { execute: doMarkRead, loading: marking } = useApiMutation({
    apiFn: (id: number) => markRead(id),
  });

  const { execute: doMarkAllRead } = useApiMutation<void, { message: string }>({
    apiFn: () => markAllRead(),
    successMessage: '全部已读',
  });

  const notifications = data || [];
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleClick = (n: Notification) => {
    if (!n.read) doMarkRead(n.id).then(refresh);
    if (n.link) navigate(n.link);
  };

  if (loading) return <Loading text="加载通知..." />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">消息通知</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} 条未读` : '全部已读'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={async () => { await doMarkAllRead(undefined as void); refresh(); }}
            disabled={marking}
            className="text-sm font-medium text-accent-purple hover:underline"
          >
            全部标为已读
          </button>
        )}
      </div>

      {/* 通知列表 */}
      {notifications.length === 0 ? (
        <EmptyState icon="🔔" title="暂无通知" description="当有新的场次、支付提醒等消息时会显示在这里" />
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                n.read
                  ? 'bg-white border-gray-100 hover:bg-gray-50'
                  : 'bg-purple-50 border-purple-100 hover:bg-purple-100'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0 mt-0.5">
                  {TYPE_ICON[n.type] || '📢'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-semibold text-sm ${n.read ? 'text-gray-700' : 'text-gray-900'}`}>
                      {n.title}
                    </h3>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-accent-purple flex-shrink-0" />
                    )}
                  </div>
                  <p className={`text-xs mt-0.5 line-clamp-2 ${n.read ? 'text-gray-400' : 'text-gray-600'}`}>
                    {n.message}
                  </p>
                  <span className="text-[12px] text-gray-400 mt-1.5 inline-block">
                    {new Date(n.created_at).toLocaleString('zh-CN')}
                  </span>
                </div>
                {n.link && (
                  <span className="text-gray-300 text-sm flex-shrink-0 self-center">→</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

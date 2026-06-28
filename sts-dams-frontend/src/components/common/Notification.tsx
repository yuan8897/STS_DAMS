import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppNotification, Notification } from '../../types';
import { getNotifications, markRead, markAllRead } from '../../api/notifications';
import { useDataFetch } from '../../hooks/useDataFetch';
import { useWebSocket } from '../../hooks/useWebSocket';
import { NOTIFICATION_TYPE_ICON } from '../../constants/maps';

/**
 * @deprecated 请使用 NotificationBell 组件的内部数据管理。
 * 此函数保留仅为兼容旧代码调用，不再实际维护全局通知数组。
 */
export function addNotification(_n: Omit<Notification, 'id'>) {
  console.warn('[STS-DAMS] addNotification 已废弃，请使用 API 发送通知。');
}

export const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<number>>(new Set());
  const navigate = useNavigate();

  // WebSocket 实时推送（替代 60s 轮询，保底 5 分钟刷新）
  const { lastMessage, connected } = useWebSocket();

  const { data: apiNotifications, refresh } = useDataFetch<AppNotification[]>({
    fetcher: (_signal) => getNotifications(false),
    refreshInterval: 300000, // 5 分钟保底轮询（WebSocket 断开时兜底）
  });

  // WebSocket 收到 new_notification 事件时自动刷新列表
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'new_notification') {
      refresh();
    }
  }, [lastMessage, refresh]);

  const items = apiNotifications || [];
  const unreadCount = items.filter(n => !n.Is_Read && !readIds.has(n.Notification_ID)).length;

  const handleMarkAllRead = useCallback(async () => {
    // 乐观标记当前所有通知为已读
    const allIds = new Set(items.map(n => n.Notification_ID));
    setReadIds(allIds);

    try {
      await markAllRead();
    } catch {
      // 离线模式下 API 调用失败，本地已乐观标记已读
      console.warn('[STS-DAMS] 标记全部已读失败，已本地标记。');
    }
    // 无论成功失败都刷新数据
    refresh();
  }, [items, refresh]);

  const handleClick = useCallback(async (n: AppNotification) => {
    // 乐观标记为已读
    setReadIds(prev => new Set(prev).add(n.Notification_ID));

    try {
      await markRead(n.Notification_ID);
    } catch {
      // 离线模式下忽略 API 错误
    }
    setOpen(false);
  }, [navigate]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label="消息通知"
        aria-expanded={open}
        className="relative p-2 text-xl"
      >
        🔔
        {connected && (
          <span className="absolute top-0 left-0 w-[7px] h-[7px] bg-green-400 rounded-full" title="实时连接" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[12px] font-bold rounded-full px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setOpen(false)} />
          <div className="fixed right-4 top-16 w-80 max-w-[90vw] max-h-[70vh] bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <h3 className="font-semibold text-sm text-gray-900">消息通知</h3>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="text-xs text-accent-purple font-medium">
                  全部已读
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">暂无通知</p>
              ) : (
                items.map(n => (
                  <button
                    key={n.Notification_ID}
                    role="menuitem"
                    onClick={() => handleClick(n)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors ${
                      !n.Is_Read && !readIds.has(n.Notification_ID) ? 'bg-purple-50/50' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      <span className="text-lg mt-0.5 flex-shrink-0">{NOTIFICATION_TYPE_ICON[n.Notification_Type] || '📌'}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 truncate">{n.Title}</span>
                          {!n.Is_Read && !readIds.has(n.Notification_ID) && <span className="w-2 h-2 rounded-full bg-accent-purple flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.Content}</p>
                        <span className="text-[12px] text-gray-400 mt-1 block">
                          {new Date(n.Created_At).toLocaleString('zh-CN')}
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { sendNotification, getNotifications } from '../../../api/notifications';
import { getAccounts } from '../../../api/accounts';
import { showToast } from '../../../components/common/Toast';
import { useDataFetch } from '../../../hooks/useDataFetch';
import { useApiMutation } from '../../../hooks/useApiMutation';
import type { AppNotification } from '../../../types';

const NOTIFICATION_TYPES = [
  { value: 'System_Announce', label: '系统公告' },
  { value: 'Session_Reminder', label: '场次提醒' },
  { value: 'Payment_Confirm', label: '支付确认' },
  { value: 'Coupon_Issued', label: '优惠券发放' },
  { value: 'Coupon_Expiring', label: '优惠券临期' },
  { value: 'Review_Request', label: '评价邀请' },
  { value: 'Low_Stock_Alert', label: '库存预警' },
];

interface AccountBrief {
  User_ID: number;
  Account_Name: string;
  Role_Type: number;
  Account_Status: string;
}

export const AdminNotificationsPage: React.FC = () => {
  const [sendMode, setSendMode] = useState<'all' | 'role' | 'specific'>('all');
  const [targetRole, setTargetRole] = useState(1);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [type, setType] = useState('System_Announce');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  // 从 API 获取所有用户（用于发送通知时选择目标）
  const { data: rawAccounts } = useDataFetch<AccountBrief[]>({
    fetcher: () => getAccounts(),
  });
  const allAccounts: AccountBrief[] = rawAccounts ?? [];

  const players = allAccounts.filter(a => a.Role_Type === 1);

  // ====== Load notification history ======
  const { data: notifications = [] } = useDataFetch<AppNotification[]>({
    fetcher: (_signal: AbortSignal) => getNotifications(),
  });

  // ====== Send notification mutation ======
  const { execute: doSend, loading: sending } = useApiMutation({
    apiFn: (payload: Parameters<typeof sendNotification>[0]) => sendNotification(payload),
    successMessage: '通知发送成功',
  });

  const toggleUser = (uid: number) => {
    setSelectedUsers(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
  };

  const handleSend = async () => {
    if (!title.trim()) { showToast('请输入通知标题', 'error'); return; }
    const payload: Record<string, unknown> = {
      Notification_Type: type, Title: title, Content: content || undefined,
    };
    if (sendMode === 'specific') {
      payload.Recipient_User_IDs = selectedUsers;
    } else if (sendMode === 'role') {
      payload.Role_Type = targetRole;
    }
    const result = await doSend(payload as Parameters<typeof sendNotification>[0]);
    if (result) {
      setTitle(''); setContent('');
    }
  };

  return (
    <div className="py-4 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">推送通知</h2>

      {/* 发送模式 */}
      <div className="card">
        <h3 className="font-medium text-sm text-gray-700 mb-2">发送模式</h3>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {([
            { key: 'all' as const, label: '全员推送' },
            { key: 'role' as const, label: '按角色' },
            { key: 'specific' as const, label: '指定用户' },
          ]).map(mode => (
            <button key={mode.key}
              onClick={() => setSendMode(mode.key)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                sendMode === mode.key ? 'bg-white text-primary shadow-sm' : 'text-gray-500'
              }`}>
              {mode.label}
            </button>
          ))}
        </div>

        {sendMode === 'role' && (
          <div className="mt-3">
            <label className="text-xs text-gray-500">目标角色</label>
            <select className="input-field w-full mt-1 text-sm" value={targetRole}
              onChange={e => setTargetRole(Number(e.target.value))}>
              <option value={1}>玩家 (Player)</option>
              <option value={2}>DM</option>
              <option value={3}>店长 (Admin)</option>
            </select>
          </div>
        )}

        {sendMode === 'specific' && (
          <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
            <button onClick={() => selectedUsers.length === players.length ? setSelectedUsers([]) : setSelectedUsers(players.map(p => p.User_ID))}
              className="text-xs text-purple-600 mb-1">
              {selectedUsers.length === players.length ? '取消全选' : '全选玩家'}
            </button>
            {players.map(p => (
              <label key={p.User_ID} className="flex items-center gap-2 py-1 cursor-pointer">
                <input type="checkbox" checked={selectedUsers.includes(p.User_ID)}
                  onChange={() => toggleUser(p.User_ID)} className="rounded border-gray-300 text-purple-600" />
                <span className="text-sm text-gray-700">{p.Account_Name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 通知内容 */}
      <div className="card space-y-3">
        <div>
          <label className="text-xs text-gray-500">通知类型</label>
          <select className="input-field w-full mt-1 text-sm" value={type}
            onChange={e => setType(e.target.value)}>
            {NOTIFICATION_TYPES.map(nt => (
              <option key={nt.value} value={nt.value}>{nt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">通知标题</label>
          <input className="input-field w-full mt-1 text-sm" value={title}
            onChange={e => setTitle(e.target.value)} placeholder="例如：新剧本《昆仑》已上线" />
        </div>
        <div>
          <label className="text-xs text-gray-500">通知内容 (选填)</label>
          <textarea className="input-field w-full mt-1 text-sm min-h-[80px] resize-none" value={content}
            onChange={e => setContent(e.target.value)} placeholder="详细通知内容..." />
        </div>
        <button onClick={handleSend} disabled={sending}
          className="btn-primary w-full py-2 text-sm disabled:opacity-50">
          {sending ? '发送中...' : '发送通知'}
        </button>
      </div>

      {/* 历史通知 */}
      <div className="card">
        <h3 className="font-medium text-sm text-gray-700 mb-2">最近通知</h3>
        <div className="space-y-1.5">
          {(notifications || []).map(n => (
            <div key={n.Notification_ID} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-700 truncate">{n.Title}</p>
                <p className="text-[12px] text-gray-400 truncate">{n.Content}</p>
              </div>
              <span className={`text-[12px] ml-2 ${n.Is_Read ? 'text-gray-300' : 'text-purple-500 font-medium'}`}>
                {n.Is_Read ? '已读' : '未读'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

import { get, put, post } from './client';
import type { AppNotification } from '../types';

export function getNotifications(unreadOnly?: boolean) {
  const qs = unreadOnly ? '?unread_only=true' : '';
  return get<AppNotification[]>(`/notifications${qs}`);
}

export function getUnreadCount() {
  return get<{ Unread_Count: number }>('/notifications/unread-count');
}

export function markRead(id: number) {
  return put<{ message: string }>(`/notifications/${id}/mark-read`);
}

export function markAllRead() {
  return put<{ message: string }>('/notifications/mark-all-read');
}

export function sendNotification(data: {
  Recipient_User_IDs?: number[]; Role_Type?: number;
  Notification_Type?: string; Title: string; Content?: string;
  Related_Entity_Type?: string; Related_Entity_ID?: string;
}) {
  return post<{ message: string }>('/notifications/send', data);
}

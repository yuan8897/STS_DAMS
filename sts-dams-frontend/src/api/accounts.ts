import { get } from './client';
import type { Account } from '../types';

export function getAccounts(params?: { role?: number; status?: string }): Promise<Account[]> {
  const qs = new URLSearchParams();
  if (params?.role) qs.set('role', String(params.role));
  if (params?.status) qs.set('status', params.status);
  const qstr = qs.toString();
  // 后端 paginate() 返回 {data: [...], page, ...}，此处解包为纯数组
  return get<any>(`/accounts${qstr ? '?' + qstr : ''}`).then(res => res.data ?? res);
}

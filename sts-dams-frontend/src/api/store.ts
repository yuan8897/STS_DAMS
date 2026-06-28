import { get, put } from './client';

export interface StoreInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  businessHours?: string;
  updatedAt?: string;
}

export function getStoreInfo(): Promise<StoreInfo> {
  return get('/store/info');
}

export function updateStoreInfo(data: Partial<StoreInfo>): Promise<{ message: string }> {
  return put('/store/info', data);
}

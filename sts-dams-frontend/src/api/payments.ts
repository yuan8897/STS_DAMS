import { get, post } from './client';
import type { PaymentTransaction } from '../types';

interface DailySummary {
  date: string;
  total_deposit: number;
  total_final_payment: number;
  total_refund: number;
  total_adjustment: number;
  net_revenue: number;
  by_method: Record<string, number>;
}

export function createPayment(data: {
  Registration_ID: number;
  Transaction_Type: string;
  Amount: number;
  Payment_Method: string;
  External_Reference_No?: string;
  Remarks?: string;
}): Promise<{ Transaction_ID: number; message: string }> {
  return post('/payments', data);
}

export function createRefund(data: {
  Registration_ID: number;
  Amount: number;
  Payment_Method: string;
  Remarks?: string;
}): Promise<{ Transaction_ID: number; message: string }> {
  return post('/payments/refund', data);
}

export function getDailySummary(date: string): Promise<DailySummary> {
  return get(`/payments/daily-summary?date=${date}`);
}

/** 获取用户的支付记录 */
export function getMyPayments(userId: number): Promise<PaymentTransaction[]> {
  return get<PaymentTransaction[]>(`/payments?user_id=${userId}`);
}

import { get, post, put, del } from './client';
import type { CouponTemplate, CouponInstance, CouponVerifyResult, IssuedCouponDetail } from '../types';

// 模板管理 (Admin)
export function getTemplates() {
  return get<CouponTemplate[]>('/coupons/templates');
}

export function createTemplate(data: {
  Coupon_Name: string; Discount_Type: string; Discount_Value: number;
  Min_Order_Amount?: number; Max_Discount_Cap?: number; Valid_Days_From_Issue: number;
  Applicable_Script_ID?: number; Total_Issuance_Limit?: number; Per_User_Limit?: number;
}) {
  return post<{ Template_ID: number; message: string }>('/coupons/templates', data);
}

export function updateTemplate(id: number, data: Record<string, unknown>) {
  return put<{ message: string }>(`/coupons/templates/${id}`, data);
}

export function toggleTemplate(id: number) {
  return put<{ message: string }>(`/coupons/templates/${id}/toggle`);
}

// 用户钱包
export function getWallet(status?: string) {
  const qs = status ? `?status=${status}` : '';
  return get<CouponInstance[]>(`/coupons/wallet${qs}`);
}

// DM 查看指定玩家的优惠券
export function getPlayerCoupons(userId: number) {
  return get<CouponInstance[]>(`/coupons/player/${userId}`);
}

// 优惠券实例列表 (Admin 查看所有已发放优惠券)
export function getInstances(params?: {
  template_id?: number; status?: string; user_id?: number; verification_code?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.template_id) qs.set('template_id', String(params.template_id));
  if (params?.status) qs.set('status', params.status);
  if (params?.user_id) qs.set('user_id', String(params.user_id));
  if (params?.verification_code) qs.set('verification_code', params.verification_code);
  const qstr = qs.toString();
  return get<CouponInstance[]>(`/coupons/instances${qstr ? '?' + qstr : ''}`);
}

// 发放与核销
export function issueCoupons(data: { Template_ID: number; User_IDs: number[] }) {
  return post<{ message: string; Issued_Count: number; Skipped_Count: number; Issued_Details: IssuedCouponDetail[] }>('/coupons/issue', data);
}

export function redeemCoupon(data: { Coupon_ID: number; Transaction_ID: number; Order_Amount: number }) {
  return post<{ message: string; Discount_Amount: number }>('/coupons/redeem', data);
}

// DM 通过验证码核销优惠券（preview=true 仅查询不核销，Admin 预览用）
export function verifyCouponByCode(data: { Verification_Code: string; Transaction_ID?: number; Order_Amount?: number; preview?: boolean }) {
  return post<CouponVerifyResult>('/coupons/verify-by-code', data);
}

// 核销记录 (Admin)
export function getUsageLog(params?: { template_id?: number; from?: string; to?: string }) {
  const qs = new URLSearchParams();
  if (params?.template_id) qs.set('template_id', String(params.template_id));
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  const qstr = qs.toString();
  return get<Record<string, unknown>[]>(`/coupons/usage-log${qstr ? '?' + qstr : ''}`);
}

export function deleteUsageLog(id: number) {
  return del<{ message: string }>(`/coupons/usage-log/${id}`);
}

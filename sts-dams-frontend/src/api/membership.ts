import { get, post, put, del } from './client';
import type { MemberLevel, MemberProfile, PointsLedgerEntry } from '../types';

// 等级管理
export function getLevels() {
  return get<MemberLevel[]>('/membership/levels');
}

export function createLevel(data: {
  Level_Name: string; Min_Required_Points: number; Discount_Rate: number;
  Point_Earning_Multiplier?: number;
}) {
  return post<{ Level_ID: number; message: string }>('/membership/levels', data);
}

export function updateLevel(id: number, data: {
  Level_Name: string; Min_Required_Points: number; Discount_Rate: number;
  Point_Earning_Multiplier?: number;
}) {
  return put<{ message: string }>(`/membership/levels/${id}`, data);
}

export function deleteLevel(id: number) {
  return del<{ message: string }>(`/membership/levels/${id}`);
}

// 会员档案
export function getMyProfile() {
  return get<MemberProfile>('/membership/profile');
}

export function getUserPoints(userId: number) {
  return get<MemberProfile>(`/membership/users/${userId}/points`);
}

export function getPointsLedger(userId: number, type?: string) {
  const qs = type ? `?type=${type}` : '';
  return get<PointsLedgerEntry[]>(`/membership/users/${userId}/points/ledger${qs}`);
}

// 积分操作
export function manualPoints(userId: number, data: { Points_Delta: number; Remarks?: string }) {
  return post<{ message: string; New_Balance: number }>(`/membership/users/${userId}/points/manual`, data);
}

export function redeemPoints(userId: number, data: { Points_To_Redeem: number; Order_Amount: number; Remarks?: string }) {
  return post<{ message: string; Redeemed_Points: number; Redeem_Amount: number; New_Balance: number }>(`/membership/users/${userId}/points/redeem`, data);
}

import { get } from './client';
import type { PlayerLTV } from '../types';

interface DailyKPI {
  Snapshot_ID: number;
  Snapshot_Date: string;
  Total_Sessions: number;
  Completed_Sessions: number;
  Aborted_Sessions: number;
  Total_Revenue_Script: number;
  Total_Revenue_Consumption: number;
  Total_Refund: number;
  Active_Players: number;
  New_Registrations: number;
}

interface SocialEdge {
  Player_A_ID: number;
  Player_B_ID: number;
  Account_A_Name: string;
  Account_B_Name: string;
  Co_Play_Count: number;
}

interface InventoryTurnover {
  Item_ID: number;
  Item_Name: string;
  total_sold: number;
  total_purchased: number;
  Current_Stock_Cache: number;
  Safety_Alert_Threshold: number;
}

export interface RoomUtilizationItem {
  room_id: number;
  room_name: string;
  max_capacity: number;
  total_sessions: number;
  total_minutes_used: number;
  share_pct: number;
  utilization_pct: number;
}

export interface RoomUtilization {
  total_rooms: number;
  total_minutes_used: number;
  total_available_minutes: number;
  overall_utilization_pct: number;
  rooms: RoomUtilizationItem[];
}

export interface SessionStatusDistItem {
  Session_Status: string;
  Count: number;
}

export interface DmPerformanceItem {
  DM_User_ID: number;
  DM_Stage_Name: string;
  Completed_Sessions: number;
  Active_Sessions: number;
}

export interface ScriptRankingItem {
  Script_ID: number;
  Script_Title: string;
  Session_Count: number;
  Total_Revenue: number;
}

export interface GenreRevenueItem {
  Genre_Name: string;
  Revenue: number;
}

export function getDailyKPI(from?: string, to?: string): Promise<DailyKPI[]> {
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const qs = '?' + new URLSearchParams(params).toString();
  return get(`/reports/daily-kpi${qs}`);
}

export function getPlayerLTV(userId?: number): Promise<PlayerLTV[]> {
  const qs = userId ? `?user_id=${userId}` : '';
  return get(`/reports/player-ltv${qs}`);
}

export function getSocialTopology(minCoPlay?: number): Promise<SocialEdge[]> {
  const qs = minCoPlay ? `?min_co_play=${minCoPlay}` : '';
  return get(`/reports/social-topology${qs}`);
}

export function getInventoryTurnover(): Promise<InventoryTurnover[]> {
  return get('/reports/inventory-turnover');
}

export function getRoomUtilization(from?: string, to?: string): Promise<RoomUtilization> {
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const qs = '?' + new URLSearchParams(params).toString();
  return get(`/reports/room-utilization${qs}`);
}

export function getSessionStatusDistribution(from?: string, to?: string): Promise<SessionStatusDistItem[]> {
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const qs = '?' + new URLSearchParams(params).toString();
  return get(`/reports/session-status-distribution${qs}`);
}

export function getDmPerformance(from?: string, to?: string): Promise<DmPerformanceItem[]> {
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const qs = '?' + new URLSearchParams(params).toString();
  return get(`/reports/dm-performance${qs}`);
}

export function getScriptRanking(from?: string, to?: string, limit?: number): Promise<ScriptRankingItem[]> {
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to) params.to = to;
  if (limit) params.limit = String(limit);
  const qs = '?' + new URLSearchParams(params).toString();
  return get(`/reports/script-ranking${qs}`);
}

export function getGenreRevenue(from?: string, to?: string): Promise<GenreRevenueItem[]> {
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const qs = '?' + new URLSearchParams(params).toString();
  return get(`/reports/genre-revenue${qs}`);
}

import { get } from './client';

export interface AuditLog {
  Audit_ID: number;
  Store_ID: number;
  Operator_User_ID: number;
  Operator_Name?: string;
  Action_Type: string;
  Target_Entity: string;
  Target_Record_ID: string;
  Action_Details: string | null;
  Client_IP: string | null;
  Logged_At: string;
}

export interface AuditLogListResponse {
  records: AuditLog[];
  total: number;
  page: number;
  size: number;
}

export interface AuditStats {
  overview: {
    Total: number;
    ActiveOperators: number;
    ActionTypes: number;
    EntityTypes: number;
    Earliest: string;
    Latest: string;
  };
  byAction: { Action_Type: string; Count: number }[];
  byEntity: { Target_Entity: string; Count: number }[];
  dailyTrend: { Date: string; Count: number }[];
  topOperators: { Operator_User_ID: number; Account_Name: string; Count: number }[];
}

export function getAuditLogs(params?: Record<string, string>): Promise<AuditLogListResponse> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return get(`/audit-logs${qs}`);
}

export function getAuditLog(id: number): Promise<AuditLog> {
  return get(`/audit-logs/${id}`);
}

export function getAuditStats(): Promise<AuditStats> {
  return get('/audit-logs/stats');
}

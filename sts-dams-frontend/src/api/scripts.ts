import { get, post, put, del } from './client';
import type { Script, ScriptRole, ScriptCopy } from '../types';

export function getScripts(params?: Record<string, string>): Promise<Script[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  // 后端 /api/scripts 返回分页对象 { data, page, size, total, totalPages }，解包 data 数组
  return get<{ data: Script[] }>(`/scripts${qs}`).then(res => res.data ?? []);
}

export function getScript(id: number): Promise<Script & { Roles: ScriptRole[] }> {
  return get(`/scripts/${id}`);
}

export function createScript(data: Partial<Script>): Promise<{ Script_ID: number }> {
  return post('/scripts', data);
}

export function updateScript(id: number, data: Partial<Script>): Promise<{ message: string }> {
  return put(`/scripts/${id}`, data);
}

export function retireScript(id: number): Promise<{ message: string }> {
  return put(`/scripts/${id}/retire`);
}

export function getScriptRoles(id: number): Promise<ScriptRole[]> {
  return get(`/scripts/${id}/roles`);
}

export function createScriptRole(id: number, data: Partial<ScriptRole>): Promise<{ message: string }> {
  return post(`/scripts/${id}/roles`, data);
}

export function updateScriptRole(roleId: number, data: Partial<ScriptRole>): Promise<{ message: string }> {
  return put(`/scripts/roles/${roleId}`, data);
}

export function deleteScriptRole(roleId: number): Promise<{ message: string }> {
  return del(`/scripts/roles/${roleId}`);
}

export function getScriptCopies(id: number): Promise<ScriptCopy[]> {
  return get(`/scripts/${id}/copies`);
}

export function createScriptCopy(id: number, data: Partial<ScriptCopy>): Promise<{ message: string }> {
  return post(`/scripts/${id}/copies`, data);
}

export function updateScriptCopy(copyId: number, data: Partial<ScriptCopy>): Promise<{ message: string }> {
  return put(`/scripts/copies/${copyId}`, data);
}

export function updateCopyCondition(copyId: number, condition: string): Promise<{ message: string }> {
  return put(`/scripts/copies/${copyId}/condition`, { Asset_Condition: condition });
}

export interface AvailableCopy extends ScriptCopy {
  Script_Title: string;
  Min_Required_Players: number;
  Max_Allowed_Players: number;
  Estimated_Duration: number;
  Base_Price: number;
}

export function getAvailableCopies(scriptId: number): Promise<AvailableCopy[]> {
  return get<AvailableCopy[]>(`/scripts/available-copies?script_id=${scriptId}`);
}

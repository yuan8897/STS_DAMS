import { get, post, put, del } from './client';
import type { DMProfile, DMScriptCapability, DMShift } from '../types';

export function getDMs(params?: Record<string, string>): Promise<DMProfile[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return get<DMProfile[]>(`/dms${qs}`);
}

export function getDM(id: number): Promise<DMProfile> {
  return get(`/dms/${id}`);
}

export function updateDM(id: number, data: Partial<DMProfile>): Promise<{ message: string }> {
  return put(`/dms/${id}`, data);
}

export function getDMCapabilities(dmId: number): Promise<DMScriptCapability[]> {
  return get(`/dms/${dmId}/capabilities`);
}

export function createDMCapability(dmId: number, data: { Script_ID: number; Proficiency_Level: string }): Promise<{ message: string }> {
  return post(`/dms/${dmId}/capabilities`, data);
}

export function deleteDMCapability(dmId: number, capId: number): Promise<{ message: string }> {
  return del(`/dms/${dmId}/capabilities/${capId}`);
}

export function getDMShifts(dmId: number): Promise<DMShift[]> {
  return get(`/dms/${dmId}/shifts`);
}

export function createDMShift(dmId: number, data: { Available_Start: string; Available_End: string; Shift_Type: string; Script_ID?: number }): Promise<{ message: string }> {
  return post(`/dms/${dmId}/shifts`, data);
}

export function updateDMShift(shiftId: number, data: Partial<DMShift>): Promise<{ message: string }> {
  return put(`/dms/shifts/${shiftId}`, data);
}

export function deleteDMShift(shiftId: number): Promise<{ message: string }> {
  return del(`/dms/shifts/${shiftId}`);
}

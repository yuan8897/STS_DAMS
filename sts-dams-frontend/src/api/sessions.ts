import { get, post, put, del } from './client';
import type { Session, LobbySession, SessionGridData, PlayerRegistration } from '../types';

/** 复用 types/index.ts 中的 Session 类型（已含 Players/Roles 嵌套字段） */
export type SessionDetailResponse = Session;

interface GridResponse {
  date: string;
  rooms: {
    Room_ID: number;
    Room_Name: string;
    Room_Max_Capacity: number;
    sessions: {
      Session_ID: number;
      Script_Title: string;
      DM_Stage_Name: string;
      Start: string;
      End: string;
      Status: string;
      Player_Count: number;
      Max_Players: number;
      Frozen_Per_Head_Price: number;
    }[];
  }[];
}

export function getSessions(params?: Record<string, string>): Promise<Session[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return get<Session[]>(`/sessions${qs}`);
}

export function getMatchingSessions(params?: Record<string, string>): Promise<Session[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return get<Session[]>(`/sessions/matching${qs}`);
}

export function getSessionGrid(date: string): Promise<SessionGridData> {
  return get<GridResponse>(`/sessions/grid?date=${date}`).then(data => ({
    date: data.date,
    rooms: data.rooms.map(r => ({
      Room_ID: r.Room_ID,
      Room_Name: r.Room_Name,
      Room_Max_Capacity: r.Room_Max_Capacity,
      sessions: r.sessions.map(s => ({
        Session_ID: s.Session_ID,
        Script_Title: s.Script_Title,
        DM_Stage_Name: s.DM_Stage_Name,
        Start: s.Start,
        End: s.End,
        Status: s.Status as SessionGridData['rooms'][0]['sessions'][0]['Status'],
        Player_Count: s.Player_Count,
        Max_Players: s.Max_Players,
        Frozen_Per_Head_Price: s.Frozen_Per_Head_Price,
      })),
    })),
  }));
}

export function getSessionDetail(id: number): Promise<SessionDetailResponse> {
  return get<SessionDetailResponse>(`/sessions/${id}`);
}

export function createSession(data: {
  Copy_ID?: number;
  Script_ID?: number;
  Room_ID: number;
  DM_User_ID: number;
  Scheduled_Start_Time: string;
  Scheduled_End_Time: string;
  Frozen_Per_Head_Price: number;
}): Promise<{ Session_ID: number; message: string }> {
  return post('/sessions', data);
}

export function updateSessionStatus(id: number, status: string): Promise<{ message: string }> {
  return put(`/sessions/${id}/status`, { Session_Status: status });
}

export function cancelSession(id: number): Promise<{ message: string }> {
  return put(`/sessions/${id}/cancel`);
}

export function joinSession(id: number): Promise<{ Registration_ID: number; message: string }> {
  return post(`/sessions/${id}/join`);
}

export function leaveSession(id: number): Promise<{ message: string }> {
  return del(`/sessions/${id}/leave`);
}

export function assignRole(regId: number, roleId: number | null): Promise<{ message: string }> {
  return put(`/sessions/registrations/${regId}/role`, { Role_ID: roleId });
}

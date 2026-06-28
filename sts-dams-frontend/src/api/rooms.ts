import { get, post, put } from './client';
import type { StoreRoom } from '../types';

export function getRooms(): Promise<StoreRoom[]> {
  return get<StoreRoom[]>('/rooms');
}

export function createRoom(data: { Room_Name: string; Room_Max_Capacity: number; Room_Theme?: string }): Promise<{ Room_ID: number }> {
  return post('/rooms', data);
}

export function updateRoom(id: number, data: Partial<StoreRoom>): Promise<{ message: string }> {
  return put(`/rooms/${id}`, data);
}

export function updateRoomStatus(id: number, status: string): Promise<{ message: string }> {
  return put(`/rooms/${id}/status`, { Room_Operating_Status: status });
}

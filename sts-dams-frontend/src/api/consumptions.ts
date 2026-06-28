import { get, post } from './client';
import type { SessionConsumption } from '../types';

export function getSessionConsumptions(sessionId: number): Promise<SessionConsumption[]> {
  return get(`/sessions/${sessionId}/consumptions`);
}

export function createConsumptions(
  sessionId: number,
  items: { Item_ID: number; Consumed_Quantity: number }[]
): Promise<{ message: string; details: { Consumption_ID: number; Item_ID: number; Consumed_Quantity: number; Unit_Price_At_Sale: number; Line_Total_Cost: number }[] }> {
  return post(`/sessions/${sessionId}/consumptions`, items);
}

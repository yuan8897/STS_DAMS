import { get, post, put } from './client';
import type { InventoryItem, InventoryMovement } from '../types';

interface InventoryDetail extends InventoryItem {
  Recent_Movements: InventoryMovement[];
}

export function getInventoryItems(params?: Record<string, string>): Promise<(InventoryItem & { is_low_stock: number })[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return get(`/inventory${qs}`);
}

export function getInventoryItem(id: number): Promise<InventoryDetail> {
  return get(`/inventory/${id}`);
}

export function createInventoryItem(data: {
  Item_Name: string;
  Current_Stock_Cache: number;
  Cost_Unit_Price: number;
  Selling_Unit_Price: number;
  Item_Category?: string;
  Safety_Alert_Threshold?: number;
}): Promise<{ Item_ID: number }> {
  return post('/inventory', data);
}

export function updateInventoryItem(id: number, data: Partial<InventoryItem>): Promise<{ message: string }> {
  return put(`/inventory/${id}`, data);
}

export function stockIn(id: number, Quantity: number, Reason?: string): Promise<{ message: string }> {
  return post(`/inventory/${id}/stock-in`, { Quantity, Reason });
}

export function damageOut(id: number, Quantity: number, Reason?: string): Promise<{ message: string }> {
  return post(`/inventory/${id}/damage`, { Quantity, Reason });
}

export function adjustInventory(id: number, Actual_Count: number, Reason?: string): Promise<{ message: string }> {
  return post(`/inventory/${id}/adjust`, { Actual_Count, Reason });
}

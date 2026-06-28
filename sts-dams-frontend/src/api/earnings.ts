import { get } from './client';

export interface DMEarnings {
  DM_User_ID: number;
  Total_Sessions: number;
  Completed_Sessions: number;
  In_Progress_Sessions: number;
  Completed_Revenue: number;
  Estimated_Revenue: number;
  Avg_Per_Session_Revenue: number;
  Monthly_Data: Record<string, { count: number; revenue: number }>;
  Sessions: DMEarningsSession[];
}

export interface DMEarningsSession {
  Session_ID: number;
  Session_Status: string;
  Scheduled_Start_Time: string;
  Frozen_Per_Head_Price: number;
  Script_Title: string;
  Room_Name: string;
  Min_Required_Players: number;
  Max_Allowed_Players: number;
  Registered_Count: number;
}

export function getDMEarnings(dmId: number): Promise<DMEarnings> {
  return get(`/dms/${dmId}/earnings`);
}

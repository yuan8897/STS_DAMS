import { get, post } from './client';
import type { SessionReview, DMReviewStats } from '../types';

export function getReviews(params?: { session_id?: number; dm_id?: number; script_id?: number; rating_min?: number }) {
  const qs = new URLSearchParams();
  if (params?.session_id) qs.set('session_id', String(params.session_id));
  if (params?.dm_id) qs.set('dm_id', String(params.dm_id));
  if (params?.script_id) qs.set('script_id', String(params.script_id));
  if (params?.rating_min) qs.set('rating_min', String(params.rating_min));
  const qstr = qs.toString();
  return get<SessionReview[]>(`/reviews${qstr ? '?' + qstr : ''}`);
}

export function getReview(id: number) {
  return get<SessionReview>(`/reviews/${id}`);
}

export function submitReview(data: {
  Session_ID: number; DM_Rating: number; Script_Rating: number;
  Room_Rating: number; Overall_Rating: number;
  Review_Comment?: string; Tags?: string; Is_Anonymous?: boolean;
}) {
  return post<{ Review_ID: number; message: string }>('/reviews', data);
}

export function getDMStats(dmId: number) {
  return get<{ Stats: DMReviewStats; Rating_Distribution: { Overall_Rating: number; Count: number }[] }>(`/reviews/dm/${dmId}/stats`);
}

export function getScriptStats(scriptId: number) {
  return get<{ Total_Reviews: number; Avg_Script_Rating: number; Avg_Overall_Rating: number }>(`/reviews/script/${scriptId}/stats`);
}

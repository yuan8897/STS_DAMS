import { get, post, put, del } from './client';

export interface GenreItem {
  Genre_ID: number;
  Genre_Name: string;
}

export function getGenres(): Promise<GenreItem[]> {
  return get('/lookup/genres');
}

export function createGenre(Genre_Name: string): Promise<{ Genre_ID: number; message: string }> {
  return post('/lookup/genres', { Genre_Name });
}

export function updateGenre(id: number, Genre_Name: string): Promise<{ message: string }> {
  return put(`/lookup/genres/${id}`, { Genre_Name });
}

export function deleteGenre(id: number): Promise<{ message: string }> {
  return del(`/lookup/genres/${id}`);
}

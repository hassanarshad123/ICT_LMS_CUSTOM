import { apiClient } from './client';

export interface SearchResultUser {
  id: string;
  name: string;
  email: string;
  role: string;
  type: 'user';
}

export interface SearchResultBatch {
  id: string;
  name: string;
  type: 'batch';
}

export interface SearchResultCourse {
  id: string;
  title: string;
  type: 'course';
}

export interface SearchResultAnnouncement {
  id: string;
  title: string;
  scope: string;
  type: 'announcement';
}

export type SearchResult = SearchResultUser | SearchResultBatch | SearchResultCourse | SearchResultAnnouncement;

export interface SearchResults {
  users: SearchResultUser[];
  batches: SearchResultBatch[];
  courses: SearchResultCourse[];
  announcements: SearchResultAnnouncement[];
}

export async function globalSearch(q: string, limit: number = 5): Promise<SearchResults> {
  return apiClient('/search', { params: { q, limit } });
}

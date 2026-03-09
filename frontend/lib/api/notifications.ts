import { apiClient } from './client';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt?: string;
}

export interface PaginatedNotifications {
  data: NotificationItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export async function listNotifications(params?: {
  page?: number;
  per_page?: number;
}): Promise<PaginatedNotifications> {
  return apiClient('/notifications', { params: params as Record<string, string | number | undefined> });
}

export async function getUnreadCount(): Promise<{ count: number }> {
  return apiClient('/notifications/unread-count');
}

export async function markAsRead(notificationId: string): Promise<NotificationItem> {
  return apiClient(`/notifications/${notificationId}/read`, { method: 'PATCH' });
}

export async function markAllRead(): Promise<{ marked: number }> {
  return apiClient('/notifications/mark-all-read', { method: 'POST' });
}

import { apiClient } from './client';
import type { PaginatedResponse } from '@/lib/types/api';
import type { NotificationItem } from '@/lib/types/notification';

export async function listNotifications(params?: {
  page?: number;
  perPage?: number;
}): Promise<PaginatedResponse<NotificationItem>> {
  return apiClient<PaginatedResponse<NotificationItem>>('/notifications', {
    params: {
      page: params?.page,
      per_page: params?.perPage,
    },
  });
}

export async function getUnreadCount(): Promise<{ count: number }> {
  return apiClient<{ count: number }>('/notifications/unread-count');
}

export async function markAsRead(notificationId: string): Promise<NotificationItem> {
  return apiClient<NotificationItem>(`/notifications/${notificationId}/read`, {
    method: 'PATCH',
  });
}

export async function markAllRead(): Promise<{ marked: number }> {
  return apiClient<{ marked: number }>('/notifications/mark-all-read', {
    method: 'POST',
  });
}

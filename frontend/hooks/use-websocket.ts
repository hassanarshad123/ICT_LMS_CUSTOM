'use client';

import { useEffect, useRef, useCallback } from 'react';
import { WebSocketClient } from '@/lib/ws/client';

export function useClassStatus(batchId: string, onStatusChange: (data: any) => void) {
  const wsRef = useRef<WebSocketClient | null>(null);

  useEffect(() => {
    if (!batchId) return;

    const ws = new WebSocketClient(`/ws/class-status/${batchId}`);
    ws.on('class_status_changed', onStatusChange);
    ws.connect();
    wsRef.current = ws;

    return () => {
      ws.disconnect();
    };
  }, [batchId, onStatusChange]);
}

export function useAnnouncements(userId: string, onAnnouncement: (data: any) => void) {
  const wsRef = useRef<WebSocketClient | null>(null);

  useEffect(() => {
    if (!userId) return;

    const ws = new WebSocketClient(`/ws/announcements/${userId}`);
    ws.on('new_announcement', onAnnouncement);
    ws.connect();
    wsRef.current = ws;

    return () => {
      ws.disconnect();
    };
  }, [userId, onAnnouncement]);
}

export function useNotificationCount(userId: string, onCountChange: (count: number) => void) {
  const wsRef = useRef<WebSocketClient | null>(null);

  useEffect(() => {
    if (!userId) return;

    const ws = new WebSocketClient(`/ws/notifications/${userId}`);
    ws.on('notification_count_changed', (data: any) => {
      if (typeof data.count === 'number') {
        onCountChange(data.count);
      }
    });
    ws.connect();
    wsRef.current = ws;

    return () => {
      ws.disconnect();
    };
  }, [userId, onCountChange]);
}

export function useSessionMonitor(sessionId: string, onTerminated: () => void) {
  const wsRef = useRef<WebSocketClient | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const ws = new WebSocketClient(`/ws/session/${sessionId}`);
    ws.on('session_terminated', onTerminated);
    ws.connect();
    wsRef.current = ws;

    return () => {
      ws.disconnect();
    };
  }, [sessionId, onTerminated]);
}

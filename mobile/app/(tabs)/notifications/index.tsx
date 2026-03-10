import { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useBranding } from '@/lib/contexts/branding-context';
import { useNotification } from '@/lib/contexts/notification-context';
import { usePaginatedApi } from '@/lib/hooks/use-paginated-api';
import { useMutation } from '@/lib/hooks/use-mutation';
import { listNotifications, markAsRead, markAllRead } from '@/lib/api/notifications';
import { PaginatedFlatList } from '@/components/shared/PaginatedFlatList';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/lib/constants/colors';
import { formatRelativeTime } from '@/lib/utils/format';
import { showSuccess, showError } from '@/lib/utils/toast';
import type { NotificationItem } from '@/lib/types/notification';

export default function NotificationsScreen() {
  const { accentColor } = useBranding();
  const accent = accentColor || Colors.accent;
  const { refreshUnreadCount } = useNotification();

  const { data, loading, loadingMore, error, hasMore, loadMore, refetch } = usePaginatedApi(
    (params) => listNotifications({ page: params.page, perPage: params.per_page }),
    20,
    [],
  );

  const markReadMutation = useMutation(markAsRead);
  const markAllMutation = useMutation(markAllRead);

  const handleMarkRead = useCallback(
    async (item: NotificationItem) => {
      if (item.read) return;
      try {
        await markReadMutation.execute(item.id);
        refetch();
        refreshUnreadCount();
      } catch {
        // Silently fail for individual mark-read
      }
    },
    [markReadMutation, refetch, refreshUnreadCount],
  );

  const handleMarkAllRead = useCallback(async () => {
    try {
      const res = await markAllMutation.execute();
      showSuccess(`${res.marked} notifications marked as read`);
      refetch();
      refreshUnreadCount();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to mark all read';
      showError(msg);
    }
  }, [markAllMutation, refetch, refreshUnreadCount]);

  const getTypeIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'announcement':
        return 'megaphone';
      case 'class':
      case 'zoom':
        return 'videocam';
      case 'certificate':
        return 'ribbon';
      case 'job':
        return 'briefcase';
      case 'material':
        return 'document';
      case 'lecture':
        return 'play-circle';
      default:
        return 'notifications';
    }
  };

  const hasUnread = data.some((n) => !n.read);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {hasUnread && (
          <TouchableOpacity onPress={handleMarkAllRead} disabled={markAllMutation.loading} activeOpacity={0.7}>
            <Text style={[styles.markAllText, { color: accent }]}>
              {markAllMutation.loading ? 'Marking...' : 'Mark All Read'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <PaginatedFlatList
        data={data}
        loading={loading}
        loadingMore={loadingMore}
        error={error}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onRefresh={() => {
          refetch();
          refreshUnreadCount();
        }}
        keyExtractor={(item) => item.id}
        emptyIcon="notifications-off-outline"
        emptyTitle="No notifications"
        emptyDescription="You're all caught up!"
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Card
            style={item.read ? styles.notifCard : [styles.notifCard, styles.unreadCard] as any}
            onPress={() => handleMarkRead(item)}
          >
            <View style={styles.notifRow}>
              <View style={[styles.iconContainer, { backgroundColor: item.read ? Colors.borderLight : `${accent}20` }]}>
                <Ionicons
                  name={getTypeIcon(item.type)}
                  size={20}
                  color={item.read ? Colors.textTertiary : accent}
                />
              </View>
              <View style={styles.notifContent}>
                <Text style={[styles.notifTitle, !item.read && styles.unreadText]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.notifMessage} numberOfLines={2}>
                  {item.message}
                </Text>
                {item.createdAt && (
                  <Text style={styles.notifTime}>{formatRelativeTime(item.createdAt)}</Text>
                )}
              </View>
              {!item.read && <View style={[styles.unreadDot, { backgroundColor: accent }]} />}
            </View>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  notifCard: {
    marginBottom: 8,
  },
  unreadCard: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  unreadText: {
    fontWeight: '700',
  },
  notifMessage: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  notifTime: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
});

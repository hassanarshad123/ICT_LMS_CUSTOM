import { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/contexts/auth-context';
import { useBranding } from '@/lib/contexts/branding-context';
import { useApi } from '@/lib/hooks/use-api';
import { listBatches } from '@/lib/api/batches';
import { listAnnouncements } from '@/lib/api/announcements';
import { listClasses } from '@/lib/api/zoom';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageLoading } from '@/components/shared/PageLoading';
import { getGreeting, formatDate, formatRelativeTime } from '@/lib/utils/format';
import { Colors } from '@/lib/constants/colors';
import type { BatchOut } from '@/lib/types/batch';
import type { AnnouncementOut } from '@/lib/types/announcement';
import type { ZoomClassOut } from '@/lib/types/zoom';

export default function HomeScreen() {
  const { user } = useAuth();
  const { accentColor, primaryColor } = useBranding();
  const accent = accentColor || Colors.accent;
  const primary = primaryColor || Colors.primary;

  const batchesApi = useApi(() => listBatches({ perPage: 10 }), []);
  const announcementsApi = useApi(() => listAnnouncements({ perPage: 5 }), []);
  const classesApi = useApi(() => listClasses({ status: 'scheduled', perPage: 5 }), []);

  const isLoading = batchesApi.loading && announcementsApi.loading && classesApi.loading;

  const handleRefresh = useCallback(() => {
    batchesApi.refetch();
    announcementsApi.refetch();
    classesApi.refetch();
  }, [batchesApi, announcementsApi, classesApi]);

  const refreshing = batchesApi.loading || announcementsApi.loading || classesApi.loading;

  const batches = batchesApi.data?.data ?? [];
  const announcements = announcementsApi.data?.data ?? [];
  const upcomingClasses = classesApi.data?.data ?? [];

  const stats = useMemo(() => [
    { label: 'Batches', value: batchesApi.data?.total ?? 0, icon: 'layers-outline' as const, color: '#3B82F6' },
    { label: 'Classes', value: classesApi.data?.total ?? 0, icon: 'videocam-outline' as const, color: '#8B5CF6' },
    { label: 'Announcements', value: announcementsApi.data?.total ?? 0, icon: 'megaphone-outline' as const, color: '#F59E0B' },
  ], [batchesApi.data, classesApi.data, announcementsApi.data]);

  if (isLoading && !batchesApi.data) {
    return <PageLoading color={accent} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting banner */}
        <View style={[styles.greetingBanner, { backgroundColor: primary }]}>
          <View style={styles.greetingRow}>
            <View style={styles.greetingText}>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.userName}>{user?.name ?? 'Student'}</Text>
            </View>
            <Avatar uri={user?.avatarUrl} name={user?.name} size={48} />
          </View>
        </View>

        {/* Stats cards */}
        <View style={styles.section}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
            {stats.map((stat) => (
              <Card key={stat.label} style={styles.statCard}>
                <View style={[styles.statIconWrap, { backgroundColor: stat.color + '18' }]}>
                  <Ionicons name={stat.icon} size={22} color={stat.color} />
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </Card>
            ))}
          </ScrollView>
        </View>

        {/* My Batches */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Batches</Text>
          {batches.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>No batches enrolled yet</Text>
            </Card>
          ) : (
            <FlatList
              horizontal
              data={batches}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item }) => <BatchCard batch={item} accent={accent} />}
            />
          )}
        </View>

        {/* Announcements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Announcements</Text>
          {announcements.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>No announcements</Text>
            </Card>
          ) : (
            announcements.map((a) => <AnnouncementCard key={a.id} announcement={a} />)
          )}
        </View>

        {/* Upcoming Classes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Classes</Text>
          {upcomingClasses.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>No upcoming classes</Text>
            </Card>
          ) : (
            upcomingClasses.map((c) => <ClassCard key={c.id} zoomClass={c} accent={accent} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Subcomponents ───────────────────────────────────────────────────

function BatchCard({ batch, accent }: { batch: BatchOut; accent: string }) {
  const statusVariant = batch.status === 'active' ? 'success' : batch.status === 'completed' ? 'info' : 'default';
  return (
    <Card style={styles.batchCard}>
      <View style={[styles.batchAccent, { backgroundColor: accent }]} />
      <Text style={styles.batchName} numberOfLines={1}>{batch.name}</Text>
      <Badge label={batch.status} variant={statusVariant} style={styles.batchBadge} />
      <View style={styles.batchMeta}>
        <View style={styles.batchMetaItem}>
          <Ionicons name="book-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.batchMetaText}>{batch.courseCount} courses</Text>
        </View>
        <View style={styles.batchMetaItem}>
          <Ionicons name="people-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.batchMetaText}>{batch.studentCount}</Text>
        </View>
      </View>
      <Text style={styles.batchDate}>
        {formatDate(batch.startDate, 'MMM d')} — {formatDate(batch.endDate, 'MMM d, yyyy')}
      </Text>
    </Card>
  );
}

function AnnouncementCard({ announcement }: { announcement: AnnouncementOut }) {
  const scopeVariant = announcement.scope === 'global' ? 'info' : 'default';
  return (
    <Card style={styles.announcementCard}>
      <View style={styles.announcementHeader}>
        <Text style={styles.announcementTitle} numberOfLines={1}>{announcement.title}</Text>
        <Badge label={announcement.scope} variant={scopeVariant} />
      </View>
      <Text style={styles.announcementContent} numberOfLines={2}>{announcement.content}</Text>
      <View style={styles.announcementFooter}>
        {announcement.postedByName && (
          <Text style={styles.announcementMeta}>{announcement.postedByName}</Text>
        )}
        <Text style={styles.announcementMeta}>{formatRelativeTime(announcement.createdAt)}</Text>
      </View>
    </Card>
  );
}

function ClassCard({ zoomClass, accent }: { zoomClass: ZoomClassOut; accent: string }) {
  const handleJoin = useCallback(() => {
    if (zoomClass.zoomMeetingUrl) {
      Linking.openURL(zoomClass.zoomMeetingUrl);
    }
  }, [zoomClass.zoomMeetingUrl]);

  return (
    <Card style={styles.classCard}>
      <View style={styles.classHeader}>
        <View style={styles.classInfo}>
          <Text style={styles.classTitle} numberOfLines={1}>{zoomClass.title}</Text>
          <Text style={styles.classMeta}>
            {formatDate(zoomClass.scheduledDate, 'EEE, MMM d')} at {zoomClass.scheduledTime}
          </Text>
          {zoomClass.teacherName && (
            <Text style={styles.classMeta}>{zoomClass.teacherName}</Text>
          )}
        </View>
        {zoomClass.zoomMeetingUrl && (
          <TouchableOpacity
            style={[styles.joinButton, { backgroundColor: accent }]}
            onPress={handleJoin}
            activeOpacity={0.7}
          >
            <Ionicons name="videocam" size={16} color={Colors.textOnAccent} />
            <Text style={styles.joinText}>Join</Text>
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  greetingBanner: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetingText: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  statsRow: {
    paddingHorizontal: 20,
    gap: 12,
  },
  statCard: {
    width: 120,
    alignItems: 'center',
    paddingVertical: 16,
  },
  statIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  horizontalList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  batchCard: {
    width: 200,
    overflow: 'hidden',
  },
  batchAccent: {
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
    width: 40,
  },
  batchName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  batchBadge: {
    marginBottom: 10,
  },
  batchMeta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 6,
  },
  batchMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  batchMetaText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  batchDate: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  emptyCard: {
    marginHorizontal: 20,
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
  announcementCard: {
    marginHorizontal: 20,
    marginBottom: 10,
  },
  announcementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  announcementTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginRight: 8,
  },
  announcementContent: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 8,
  },
  announcementFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  announcementMeta: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  classCard: {
    marginHorizontal: 20,
    marginBottom: 10,
  },
  classHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  classInfo: {
    flex: 1,
    marginRight: 12,
  },
  classTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  classMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  joinText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textOnAccent,
  },
});

import { useMemo, useCallback } from 'react';
import { View, Text, SectionList, Linking, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBranding } from '@/lib/contexts/branding-context';
import { useApi } from '@/lib/hooks/use-api';
import { listClasses } from '@/lib/api/zoom';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageLoading } from '@/components/shared/PageLoading';
import { PageError } from '@/components/shared/PageError';
import { EmptyState } from '@/components/shared/EmptyState';
import { Colors } from '@/lib/constants/colors';
import { formatDate } from '@/lib/utils/format';
import type { ZoomClassOut } from '@/lib/types/zoom';

export default function ClassesScreen() {
  const router = useRouter();
  const { accentColor } = useBranding();
  const accent = accentColor || Colors.accent;

  const { data, loading, error, refetch } = useApi(
    () => listClasses({ perPage: 50 }),
    [],
  );

  const classes = data?.data ?? [];

  const sections = useMemo(() => {
    const upcoming: ZoomClassOut[] = [];
    const past: ZoomClassOut[] = [];

    classes.forEach((cls) => {
      if (cls.status === 'scheduled' || cls.status === 'live') {
        upcoming.push(cls);
      } else {
        past.push(cls);
      }
    });

    const result: { title: string; data: ZoomClassOut[] }[] = [];
    if (upcoming.length > 0) result.push({ title: 'Upcoming', data: upcoming });
    if (past.length > 0) result.push({ title: 'Past Classes', data: past });
    return result;
  }, [classes]);

  const handleJoin = useCallback((cls: ZoomClassOut) => {
    if (cls.zoomMeetingUrl) {
      Linking.openURL(cls.zoomMeetingUrl);
    }
  }, []);

  const statusBadge = useCallback((status: string) => {
    switch (status) {
      case 'scheduled':
        return { label: 'Scheduled', variant: 'info' as const };
      case 'live':
        return { label: 'Live', variant: 'success' as const };
      case 'completed':
        return { label: 'Completed', variant: 'default' as const };
      case 'cancelled':
        return { label: 'Cancelled', variant: 'error' as const };
      default:
        return { label: status, variant: 'default' as const };
    }
  }, []);

  if (loading) return <PageLoading />;
  if (error) return <PageError message={error} onRetry={refetch} />;

  if (classes.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Classes</Text>
        </View>
        <EmptyState
          icon="videocam-outline"
          title="No classes yet"
          description="Your scheduled classes will appear here"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Classes</Text>
        <Button
          title="Recordings"
          onPress={() => router.push('/(tabs)/classes/recordings')}
          variant="ghost"
          icon="play-circle-outline"
          style={styles.recordingsBtn}
        />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const badge = statusBadge(item.status);
          return (
            <Card style={styles.classCard}>
              <View style={styles.classTop}>
                <View style={styles.classInfo}>
                  <Text style={styles.classTitle} numberOfLines={2}>{item.title}</Text>
                  <View style={styles.classMeta}>
                    <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.classMetaText}>
                      {formatDate(item.scheduledDate, 'EEE, MMM d')} at {item.scheduledTime}
                    </Text>
                  </View>
                  <View style={styles.classMeta}>
                    <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.classMetaText}>
                      {item.durationDisplay || `${item.duration} min`}
                    </Text>
                  </View>
                  {item.teacherName && (
                    <View style={styles.classMeta}>
                      <Ionicons name="person-outline" size={14} color={Colors.textSecondary} />
                      <Text style={styles.classMetaText}>{item.teacherName}</Text>
                    </View>
                  )}
                  {item.batchName && (
                    <View style={styles.classMeta}>
                      <Ionicons name="layers-outline" size={14} color={Colors.textSecondary} />
                      <Text style={styles.classMetaText}>{item.batchName}</Text>
                    </View>
                  )}
                </View>
                <Badge label={badge.label} variant={badge.variant} />
              </View>
              {(item.status === 'scheduled' || item.status === 'live') && item.zoomMeetingUrl && (
                <Button
                  title={item.status === 'live' ? 'Join Now' : 'Join Class'}
                  onPress={() => handleJoin(item)}
                  variant="primary"
                  icon="videocam"
                  fullWidth
                  accentColor={item.status === 'live' ? Colors.success : accent}
                  style={styles.joinBtn}
                />
              )}
            </Card>
          );
        }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refetch} tintColor={Colors.primary} />
        }
        stickySectionHeadersEnabled={false}
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
  recordingsBtn: {
    paddingHorizontal: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
    marginTop: 8,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  classCard: {
    marginBottom: 12,
  },
  classTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  classInfo: {
    flex: 1,
    marginRight: 8,
  },
  classTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  classMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  classMetaText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  joinBtn: {
    marginTop: 12,
  },
});

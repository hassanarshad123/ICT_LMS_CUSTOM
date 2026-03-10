import { useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/contexts/auth-context';
import { useApi } from '@/lib/hooks/use-api';
import { getLecture } from '@/lib/api/lectures';
import { VideoPlayer } from '@/components/shared/VideoPlayer';
import { PageLoading } from '@/components/shared/PageLoading';
import { PageError } from '@/components/shared/PageError';
import { IconButton } from '@/components/ui/IconButton';
import { Badge } from '@/components/ui/Badge';
import { Colors } from '@/lib/constants/colors';
import { formatDate } from '@/lib/utils/format';

export default function LectureScreen() {
  const { lectureId } = useLocalSearchParams<{ lectureId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const { data: lecture, loading, error, refetch } = useApi(
    () => getLecture(lectureId!),
    [lectureId],
  );

  if (loading) return <PageLoading />;
  if (error || !lecture) return <PageError message={error || 'Lecture not found'} onRetry={refetch} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton name="arrow-back" onPress={() => router.back()} />
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>{lecture.title}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Video player */}
        <View style={styles.playerWrapper}>
          <VideoPlayer
            lectureId={lecture.id}
            videoType={lecture.videoType}
            videoUrl={lecture.videoUrl}
            videoStatus={lecture.videoStatus}
            watermark={user?.email}
          />
        </View>

        {/* Lecture info */}
        <View style={styles.infoSection}>
          <Text style={styles.lectureTitle}>{lecture.title}</Text>
          <View style={styles.metaRow}>
            {lecture.durationDisplay && (
              <Badge label={lecture.durationDisplay} variant="info" />
            )}
            {lecture.videoStatus && lecture.videoStatus !== 'ready' && (
              <Badge
                label={lecture.videoStatus}
                variant={lecture.videoStatus === 'failed' ? 'error' : 'warning'}
              />
            )}
            {lecture.createdAt && (
              <Text style={styles.dateText}>{formatDate(lecture.createdAt)}</Text>
            )}
          </View>
          {lecture.description ? (
            <Text style={styles.description}>{lecture.description}</Text>
          ) : null}
        </View>
      </ScrollView>
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
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  playerWrapper: {
    paddingHorizontal: 16,
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  lectureTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  dateText: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 16,
    lineHeight: 22,
  },
});

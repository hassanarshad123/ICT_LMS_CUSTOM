import { useState, useCallback } from 'react';
import { View, Text, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useBranding } from '@/lib/contexts/branding-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { usePaginatedApi } from '@/lib/hooks/use-paginated-api';
import { listRecordings, getRecordingSignedUrl } from '@/lib/api/zoom';
import { PaginatedFlatList } from '@/components/shared/PaginatedFlatList';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { Colors } from '@/lib/constants/colors';
import { formatDate, formatFileSize } from '@/lib/utils/format';
import { showError } from '@/lib/utils/toast';
import type { RecordingItem } from '@/lib/types/zoom';

export default function RecordingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { accentColor } = useBranding();
  const accent = accentColor || Colors.accent;

  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [playbackLoading, setPlaybackLoading] = useState(false);

  const { data, loading, loadingMore, error, hasMore, loadMore, refetch } = usePaginatedApi(
    (params) => listRecordings({ page: params.page, perPage: params.per_page }),
    15,
    [],
  );

  const handlePlay = useCallback(async (recording: RecordingItem) => {
    setPlaybackLoading(true);
    try {
      const res = await getRecordingSignedUrl(recording.id);
      setPlaybackUrl(res.url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load recording';
      showError(msg);
    } finally {
      setPlaybackLoading(false);
    }
  }, []);

  const playerHtml = playbackUrl
    ? `
      <!DOCTYPE html>
      <html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: #000; }
          iframe, video { width: 100%; height: 100vh; border: none; }
        </style>
      </head><body>
        <iframe
          src="${playbackUrl}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowfullscreen
        ></iframe>
      </body></html>
    `
    : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <IconButton name="arrow-back" onPress={() => router.back()} />
        <Text style={styles.title}>Recordings</Text>
      </View>

      <PaginatedFlatList
        data={data}
        loading={loading}
        loadingMore={loadingMore}
        error={error}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onRefresh={refetch}
        keyExtractor={(item) => item.id}
        emptyIcon="play-circle-outline"
        emptyTitle="No recordings"
        emptyDescription="Class recordings will appear here"
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Card style={styles.recordingCard} onPress={() => handlePlay(item)}>
            <View style={styles.recordingRow}>
              <View style={[styles.recordingIcon, { backgroundColor: `${accent}20` }]}>
                <Ionicons name="play-circle" size={28} color={accent} />
              </View>
              <View style={styles.recordingInfo}>
                <Text style={styles.recordingTitle} numberOfLines={2}>{item.classTitle}</Text>
                {item.teacherName && (
                  <Text style={styles.metaText}>{item.teacherName}</Text>
                )}
                <View style={styles.metaRow}>
                  {item.scheduledDate && (
                    <Text style={styles.metaText}>{formatDate(item.scheduledDate, 'MMM d, yyyy')}</Text>
                  )}
                  {item.fileSize ? (
                    <Text style={styles.metaText}>{formatFileSize(item.fileSize)}</Text>
                  ) : null}
                </View>
                {item.batchName && (
                  <Badge label={item.batchName} variant="default" style={styles.batchBadge} />
                )}
              </View>
              <Ionicons name="play" size={20} color={accent} />
            </View>
          </Card>
        )}
      />

      {/* Playback loading overlay */}
      {playbackLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      )}

      {/* Video player modal */}
      <Modal visible={!!playbackUrl} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <IconButton
              name="close"
              onPress={() => setPlaybackUrl(null)}
              color={Colors.textOnPrimary}
              backgroundColor="rgba(255,255,255,0.2)"
            />
          </View>
          {playbackUrl && (
            <View style={styles.modalPlayer}>
              <WebView
                source={{ html: playerHtml }}
                style={styles.webview}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled
                allowsFullscreenVideo
              />
              {user?.email && (
                <View style={styles.watermark} pointerEvents="none">
                  <Text style={styles.watermarkText}>{user.email}</Text>
                </View>
              )}
            </View>
          )}
        </SafeAreaView>
      </Modal>
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
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginLeft: 8,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  recordingCard: {
    marginBottom: 10,
  },
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  recordingInfo: {
    flex: 1,
  },
  recordingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  batchBadge: {
    marginTop: 4,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSafe: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    position: 'absolute',
    top: 8,
    right: 12,
    zIndex: 10,
  },
  modalPlayer: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  watermark: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  watermarkText: {
    color: 'rgba(255, 255, 255, 0.15)',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 4,
  },
});

import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/contexts/auth-context';
import { useBranding } from '@/lib/contexts/branding-context';
import { useApi } from '@/lib/hooks/use-api';
import { getCourse } from '@/lib/api/courses';
import { listLectures } from '@/lib/api/lectures';
import { listModules } from '@/lib/api/curriculum';
import { listMaterials, getDownloadUrl } from '@/lib/api/materials';
import { PageLoading } from '@/components/shared/PageLoading';
import { PageError } from '@/components/shared/PageError';
import { EmptyState } from '@/components/shared/EmptyState';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { Colors } from '@/lib/constants/colors';
import { formatDate, formatFileSize } from '@/lib/utils/format';
import { showError } from '@/lib/utils/toast';
import type { LectureOut } from '@/lib/types/lecture';
import type { CurriculumModuleOut } from '@/lib/types/curriculum';
import type { MaterialOut } from '@/lib/types/material';

type Tab = 'lectures' | 'curriculum' | 'materials';

export default function CourseDetailScreen() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { accentColor } = useBranding();
  const accent = accentColor || Colors.accent;
  const [activeTab, setActiveTab] = useState<Tab>('lectures');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const { data: course, loading: courseLoading, error: courseError, refetch: refetchCourse } = useApi(
    () => getCourse(courseId!),
    [courseId],
  );

  // Resolve batch ID: intersection of course.batchIds and user.batchIds
  const batchId = useMemo(() => {
    if (!course || !user) return null;
    const userBatchSet = new Set(user.batchIds ?? []);
    return course.batchIds?.find((id) => userBatchSet.has(id)) ?? course.batchIds?.[0] ?? null;
  }, [course, user]);

  const { data: lecturesRes, loading: lecturesLoading, refetch: refetchLectures } = useApi(
    () => (batchId ? listLectures({ batchId, courseId: courseId! }) : Promise.resolve({ data: [], total: 0, page: 1, perPage: 15, totalPages: 1 })),
    [batchId, courseId],
  );

  const { data: modules, loading: modulesLoading, refetch: refetchModules } = useApi(
    () => listModules(courseId!),
    [courseId],
  );

  const { data: materialsRes, loading: materialsLoading, refetch: refetchMaterials } = useApi(
    () => (batchId ? listMaterials({ batchId, courseId: courseId! }) : Promise.resolve({ data: [], total: 0, page: 1, perPage: 15, totalPages: 1 })),
    [batchId, courseId],
  );

  const lectures = lecturesRes?.data ?? [];
  const materials = materialsRes?.data ?? [];
  const curriculumModules = modules ?? [];

  const handleLecturePress = useCallback(
    (lecture: LectureOut) => {
      router.push(`/(tabs)/courses/${courseId}/lecture/${lecture.id}`);
    },
    [router, courseId],
  );

  const handleDownload = useCallback(async (materialId: string) => {
    try {
      const { downloadUrl } = await getDownloadUrl(materialId);
      const { downloadAndShare } = await import('@/lib/utils/download');
      const material = materials.find((m) => m.id === materialId);
      await downloadAndShare(downloadUrl, material?.fileName ?? 'file');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      showError(msg);
    }
  }, [materials]);

  const toggleModule = useCallback((moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  }, []);

  const handleRefresh = useCallback(() => {
    refetchCourse();
    if (activeTab === 'lectures') refetchLectures();
    if (activeTab === 'curriculum') refetchModules();
    if (activeTab === 'materials') refetchMaterials();
  }, [activeTab, refetchCourse, refetchLectures, refetchModules, refetchMaterials]);

  if (courseLoading) return <PageLoading />;
  if (courseError) return <PageError message={courseError} onRetry={refetchCourse} />;

  const fileTypeIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    if (type.includes('pdf')) return 'document-text';
    if (type.includes('image') || type.includes('png') || type.includes('jpg')) return 'image';
    if (type.includes('video')) return 'videocam';
    if (type.includes('zip') || type.includes('rar')) return 'archive';
    return 'document';
  };

  const renderLectureItem = ({ item }: { item: LectureOut }) => (
    <Card style={styles.listItem} onPress={() => handleLecturePress(item)}>
      <View style={styles.itemRow}>
        <View style={[styles.itemIcon, { backgroundColor: `${accent}20` }]}>
          <Ionicons
            name={item.videoType === 'upload' ? 'play-circle' : 'link'}
            size={22}
            color={accent}
          />
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.itemMeta}>
            {item.durationDisplay && (
              <Text style={styles.itemMetaText}>{item.durationDisplay}</Text>
            )}
            {item.videoStatus && item.videoStatus !== 'ready' && (
              <Badge
                label={item.videoStatus}
                variant={item.videoStatus === 'failed' ? 'error' : 'warning'}
              />
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
      </View>
    </Card>
  );

  const renderModuleItem = ({ item }: { item: CurriculumModuleOut }) => {
    const isExpanded = expandedModules.has(item.id);
    return (
      <Card style={styles.listItem}>
        <TouchableOpacity style={styles.itemRow} onPress={() => toggleModule(item.id)} activeOpacity={0.7}>
          <View style={[styles.itemIcon, { backgroundColor: Colors.infoLight }]}>
            <Text style={styles.moduleOrder}>{item.sequenceOrder}</Text>
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
            {item.description && !isExpanded && (
              <Text style={styles.itemMetaText} numberOfLines={1}>{item.description}</Text>
            )}
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={Colors.textTertiary}
          />
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.topicsList}>
            {item.description && <Text style={styles.moduleDesc}>{item.description}</Text>}
            {item.topics?.map((topic, idx) => (
              <View key={idx} style={styles.topicRow}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                <Text style={styles.topicText}>{topic}</Text>
              </View>
            ))}
            {(!item.topics || item.topics.length === 0) && !item.description && (
              <Text style={styles.itemMetaText}>No topics listed</Text>
            )}
          </View>
        )}
      </Card>
    );
  };

  const renderMaterialItem = ({ item }: { item: MaterialOut }) => (
    <Card style={styles.listItem}>
      <View style={styles.itemRow}>
        <View style={[styles.itemIcon, { backgroundColor: Colors.warningLight }]}>
          <Ionicons name={fileTypeIcon(item.fileType)} size={22} color={Colors.warning} />
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.itemMeta}>
            <Text style={styles.itemMetaText}>{item.fileType.toUpperCase()}</Text>
            {item.fileSizeBytes ? (
              <Text style={styles.itemMetaText}>{formatFileSize(item.fileSizeBytes)}</Text>
            ) : null}
          </View>
        </View>
        <IconButton
          name="download-outline"
          onPress={() => handleDownload(item.id)}
          color={accent}
        />
      </View>
    </Card>
  );

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'lectures', label: 'Lectures', count: lectures.length },
    { key: 'curriculum', label: 'Curriculum', count: curriculumModules.length },
    { key: 'materials', label: 'Materials', count: materials.length },
  ];

  const getTabData = () => {
    switch (activeTab) {
      case 'lectures':
        return { data: lectures, loading: lecturesLoading, renderItem: renderLectureItem, empty: 'No lectures' };
      case 'curriculum':
        return { data: curriculumModules, loading: modulesLoading, renderItem: renderModuleItem, empty: 'No curriculum' };
      case 'materials':
        return { data: materials, loading: materialsLoading, renderItem: renderMaterialItem, empty: 'No materials' };
    }
  };

  const tabData = getTabData();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton name="arrow-back" onPress={() => router.back()} />
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>{course?.title}</Text>
        </View>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && { borderBottomColor: accent }]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && { color: accent, fontWeight: '600' },
              ]}
            >
              {tab.label} ({tab.count})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {tabData.loading ? (
        <PageLoading />
      ) : (
        <FlatList
          data={tabData.data as any[]}
          renderItem={tabData.renderItem as any}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, tabData.data.length === 0 && styles.emptyContent]}
          ListEmptyComponent={
            <EmptyState icon="folder-open-outline" title={tabData.empty} />
          }
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={Colors.primary} />
          }
        />
      )}
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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    marginHorizontal: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  emptyContent: {
    flexGrow: 1,
  },
  listItem: {
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  itemMetaText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  moduleOrder: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.info,
  },
  topicsList: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  moduleDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  topicText: {
    fontSize: 13,
    color: Colors.text,
    flex: 1,
  },
});

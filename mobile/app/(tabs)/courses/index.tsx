import { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/contexts/auth-context';
import { useBranding } from '@/lib/contexts/branding-context';
import { usePaginatedApi } from '@/lib/hooks/use-paginated-api';
import { listCourses } from '@/lib/api/courses';
import { PaginatedFlatList } from '@/components/shared/PaginatedFlatList';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Colors } from '@/lib/constants/colors';
import type { CourseOut } from '@/lib/types/course';

export default function CoursesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { accentColor } = useBranding();
  const accent = accentColor || Colors.accent;

  const batchIds = user?.batchIds ?? [];
  const batchNames = user?.batchNames ?? [];
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);

  const { data, loading, loadingMore, error, hasMore, loadMore, refetch } = usePaginatedApi(
    (params) =>
      listCourses({
        page: params.page,
        perPage: params.per_page,
        batchId: selectedBatch ?? undefined,
      }),
    15,
    [selectedBatch],
  );

  const handleCoursePress = useCallback(
    (course: CourseOut) => {
      router.push(`/(tabs)/courses/${course.id}`);
    },
    [router],
  );

  const statusVariant = useCallback((status: string) => {
    switch (status) {
      case 'active':
        return 'success' as const;
      case 'draft':
        return 'warning' as const;
      case 'archived':
        return 'default' as const;
      default:
        return 'info' as const;
    }
  }, []);

  const filterHeader = useMemo(
    () => (
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.chip, !selectedBatch && { backgroundColor: accent }]}
          onPress={() => setSelectedBatch(null)}
          activeOpacity={0.7}
        >
          <Text style={[styles.chipText, !selectedBatch && styles.chipTextActive]}>All</Text>
        </TouchableOpacity>
        {batchIds.map((id, idx) => (
          <TouchableOpacity
            key={id}
            style={[styles.chip, selectedBatch === id && { backgroundColor: accent }]}
            onPress={() => setSelectedBatch(id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, selectedBatch === id && styles.chipTextActive]}>
              {batchNames[idx] || `Batch ${idx + 1}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    ),
    [batchIds, batchNames, selectedBatch, accent],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Courses</Text>
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
        emptyIcon="book-outline"
        emptyTitle="No courses found"
        emptyDescription="You have no enrolled courses yet"
        ListHeaderComponent={batchIds.length > 1 ? filterHeader : null}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Card style={styles.courseCard} onPress={() => handleCoursePress(item)}>
            <View style={styles.courseRow}>
              <View style={styles.courseIcon}>
                <Ionicons name="book" size={24} color={accent} />
              </View>
              <View style={styles.courseInfo}>
                <Text style={styles.courseTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                {item.description ? (
                  <Text style={styles.courseDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
                <Badge label={item.status} variant={statusVariant(item.status)} style={styles.badge} />
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
  },
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.textOnAccent,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  courseCard: {
    marginBottom: 12,
  },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  courseIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  courseInfo: {
    flex: 1,
  },
  courseTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  courseDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  badge: {
    marginTop: 6,
  },
});

import { FlatList, ActivityIndicator, RefreshControl, View, StyleSheet, ListRenderItem } from 'react-native';
import { PageLoading } from './PageLoading';
import { PageError } from './PageError';
import { EmptyState } from './EmptyState';
import { Colors } from '@/lib/constants/colors';

interface PaginatedFlatListProps<T> {
  data: T[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  onRefresh: () => void;
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T, index: number) => string;
  emptyIcon?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  ListHeaderComponent?: React.ReactElement | null;
  contentContainerStyle?: object;
}

export function PaginatedFlatList<T>({
  data,
  loading,
  loadingMore,
  error,
  hasMore,
  onLoadMore,
  onRefresh,
  renderItem,
  keyExtractor,
  emptyIcon = 'file-tray-outline',
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  ListHeaderComponent,
  contentContainerStyle,
}: PaginatedFlatListProps<T>) {
  if (loading && data.length === 0) {
    return <PageLoading />;
  }

  if (error && data.length === 0) {
    return <PageError message={error} onRetry={onRefresh} />;
  }

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={
        <EmptyState
          icon={emptyIcon as any}
          title={emptyTitle}
          description={emptyDescription}
        />
      }
      ListFooterComponent={
        loadingMore ? (
          <View style={styles.footer}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : null
      }
      onEndReached={hasMore ? onLoadMore : undefined}
      onEndReachedThreshold={0.3}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.primary} />
      }
      contentContainerStyle={[data.length === 0 && styles.emptyContainer, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    flexGrow: 1,
  },
});

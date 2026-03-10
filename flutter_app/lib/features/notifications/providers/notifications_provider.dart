import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/data/repositories/notification_repository.dart';
import 'package:ict_lms_student/models/notification_out.dart';

class NotificationsState {
  final List<NotificationOut> items;
  final int page;
  final int totalPages;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;

  const NotificationsState({
    this.items = const [],
    this.page = 1,
    this.totalPages = 0,
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
  });

  bool get hasMore => page < totalPages;

  NotificationsState copyWith({
    List<NotificationOut>? items,
    int? page,
    int? totalPages,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    bool clearError = false,
  }) {
    return NotificationsState(
      items: items ?? this.items,
      page: page ?? this.page,
      totalPages: totalPages ?? this.totalPages,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class NotificationsNotifier extends StateNotifier<NotificationsState> {
  final NotificationRepository _repo;

  NotificationsNotifier(this._repo) : super(const NotificationsState()) {
    load();
  }

  Future<void> load() async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final result = await _repo.listNotifications(page: 1, perPage: 20);
      state = state.copyWith(
        items: result['data'] as List<NotificationOut>,
        page: result['page'] as int,
        totalPages: result['totalPages'] as int,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  Future<void> loadMore() async {
    if (!state.hasMore || state.isLoadingMore) return;

    state = state.copyWith(isLoadingMore: true);

    try {
      final nextPage = state.page + 1;
      final result =
          await _repo.listNotifications(page: nextPage, perPage: 20);

      final newItems = result['data'] as List<NotificationOut>;
      state = state.copyWith(
        items: [...state.items, ...newItems],
        page: result['page'] as int,
        totalPages: result['totalPages'] as int,
        isLoadingMore: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoadingMore: false,
        error: e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  Future<void> refresh() async {
    await load();
  }

  /// Optimistic mark as read: update locally first, then call API.
  Future<void> markAsRead(String notificationId) async {
    // Optimistic update.
    final updatedItems = state.items.map((n) {
      if (n.id == notificationId) {
        return n.copyWith(read: true);
      }
      return n;
    }).toList();
    state = state.copyWith(items: updatedItems);

    try {
      await _repo.markAsRead(notificationId);
    } catch (_) {
      // Revert on failure.
      final revertedItems = state.items.map((n) {
        if (n.id == notificationId) {
          return n.copyWith(read: false);
        }
        return n;
      }).toList();
      state = state.copyWith(items: revertedItems);
    }
  }

  /// Mark all as read: update locally first, then call API.
  Future<void> markAllRead() async {
    final previousItems = List<NotificationOut>.from(state.items);

    // Optimistic update.
    final updatedItems = state.items.map((n) => n.copyWith(read: true)).toList();
    state = state.copyWith(items: updatedItems);

    try {
      await _repo.markAllRead();
    } catch (_) {
      // Revert on failure.
      state = state.copyWith(items: previousItems);
    }
  }
}

final notificationsProvider = StateNotifierProvider.autoDispose<
    NotificationsNotifier, NotificationsState>((ref) {
  final repo = ref.watch(notificationRepositoryProvider);
  return NotificationsNotifier(repo);
});

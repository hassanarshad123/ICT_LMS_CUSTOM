import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/core/utils/error_utils.dart';
import 'package:ict_lms_student/data/repositories/course_repository.dart';
import 'package:ict_lms_student/models/course_out.dart';
import 'package:ict_lms_student/models/paginated_response.dart';

class CoursesListState {
  final List<CourseOut> items;
  final int page;
  final int totalPages;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final String? batchId;
  final String? statusFilter;
  final String? search;

  const CoursesListState({
    this.items = const [],
    this.page = 1,
    this.totalPages = 0,
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.batchId,
    this.statusFilter,
    this.search,
  });

  bool get hasMore => page < totalPages;

  CoursesListState copyWith({
    List<CourseOut>? items,
    int? page,
    int? totalPages,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    String? batchId,
    String? statusFilter,
    String? search,
    bool clearError = false,
    bool clearBatchId = false,
  }) {
    return CoursesListState(
      items: items ?? this.items,
      page: page ?? this.page,
      totalPages: totalPages ?? this.totalPages,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: clearError ? null : (error ?? this.error),
      batchId: clearBatchId ? null : (batchId ?? this.batchId),
      statusFilter: statusFilter ?? this.statusFilter,
      search: search ?? this.search,
    );
  }
}

class CoursesListNotifier extends StateNotifier<CoursesListState> {
  final CourseRepository _repo;

  CoursesListNotifier(this._repo) : super(const CoursesListState());

  /// Load first page with optional batch filter.
  Future<void> load({String? batchId}) async {
    state = CoursesListState(
      isLoading: true,
      batchId: batchId,
    );

    try {
      final result = await _repo.listCourses(
        page: 1,
        perPage: 20,
        batchId: batchId,
      );

      state = state.copyWith(
        items: result.data,
        page: result.page,
        totalPages: result.totalPages,
        isLoading: false,
        clearError: true,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: extractErrorMessage(e),
      );
    }
  }

  /// Load next page, append items.
  Future<void> loadMore() async {
    if (!state.hasMore || state.isLoadingMore) return;

    state = state.copyWith(isLoadingMore: true);

    try {
      final nextPage = state.page + 1;
      final result = await _repo.listCourses(
        page: nextPage,
        perPage: 20,
        batchId: state.batchId,
      );

      state = state.copyWith(
        items: [...state.items, ...result.data],
        page: result.page,
        totalPages: result.totalPages,
        isLoadingMore: false,
        clearError: true,
      );
    } catch (e) {
      state = state.copyWith(
        isLoadingMore: false,
        error: extractErrorMessage(e),
      );
    }
  }

  /// Refresh: reset to page 1 and reload.
  Future<void> refresh() async {
    await load(batchId: state.batchId);
  }

}

final coursesListProvider =
    StateNotifierProvider.autoDispose<CoursesListNotifier, CoursesListState>(
        (ref) {
  final repo = ref.watch(courseRepositoryProvider);
  return CoursesListNotifier(repo);
});

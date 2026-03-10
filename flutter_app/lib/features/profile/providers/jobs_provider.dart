import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/data/repositories/job_repository.dart';
import 'package:ict_lms_student/models/application_out.dart';
import 'package:ict_lms_student/models/job_out.dart';

// --- Jobs list (paginated) ---

class JobsListState {
  final List<JobOut> items;
  final int page;
  final int totalPages;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;

  const JobsListState({
    this.items = const [],
    this.page = 1,
    this.totalPages = 0,
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
  });

  bool get hasMore => page < totalPages;

  JobsListState copyWith({
    List<JobOut>? items,
    int? page,
    int? totalPages,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    bool clearError = false,
  }) {
    return JobsListState(
      items: items ?? this.items,
      page: page ?? this.page,
      totalPages: totalPages ?? this.totalPages,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class JobsNotifier extends StateNotifier<JobsListState> {
  final JobRepository _repo;

  JobsNotifier(this._repo) : super(const JobsListState()) {
    load();
  }

  Future<void> load() async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final result = await _repo.listJobs(page: 1, perPage: 20);
      state = state.copyWith(
        items: result['data'] as List<JobOut>,
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
      final result = await _repo.listJobs(page: nextPage, perPage: 20);

      final newItems = result['data'] as List<JobOut>;
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
}

final jobsProvider =
    StateNotifierProvider.autoDispose<JobsNotifier, JobsListState>((ref) {
  final repo = ref.watch(jobRepositoryProvider);
  return JobsNotifier(repo);
});

// --- My Applications ---

final myApplicationsProvider =
    FutureProvider.autoDispose<List<ApplicationOut>>((ref) async {
  final repo = ref.watch(jobRepositoryProvider);
  return repo.getMyApplications();
});

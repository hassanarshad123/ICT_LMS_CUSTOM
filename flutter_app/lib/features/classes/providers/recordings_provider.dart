import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/core/utils/error_utils.dart';
import 'package:ict_lms_student/data/repositories/zoom_repository.dart';
import 'package:ict_lms_student/models/recording_list_out.dart';

class RecordingsState {
  final List<RecordingListOut> items;
  final int page;
  final int totalPages;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final String? signedUrl;
  final String? signedUrlType;

  const RecordingsState({
    this.items = const [],
    this.page = 1,
    this.totalPages = 0,
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.signedUrl,
    this.signedUrlType,
  });

  bool get hasMore => page < totalPages;

  RecordingsState copyWith({
    List<RecordingListOut>? items,
    int? page,
    int? totalPages,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    String? signedUrl,
    String? signedUrlType,
    bool clearError = false,
    bool clearSignedUrl = false,
  }) {
    return RecordingsState(
      items: items ?? this.items,
      page: page ?? this.page,
      totalPages: totalPages ?? this.totalPages,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: clearError ? null : (error ?? this.error),
      signedUrl: clearSignedUrl ? null : (signedUrl ?? this.signedUrl),
      signedUrlType:
          clearSignedUrl ? null : (signedUrlType ?? this.signedUrlType),
    );
  }
}

class RecordingsNotifier extends StateNotifier<RecordingsState> {
  final ZoomRepository _repo;

  RecordingsNotifier(this._repo) : super(const RecordingsState()) {
    load();
  }

  Future<void> load() async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final result = await _repo.listRecordings(page: 1, perPage: 20);
      state = state.copyWith(
        items: result.data,
        page: result.page,
        totalPages: result.totalPages,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: extractErrorMessage(e),
      );
    }
  }

  Future<void> loadMore() async {
    if (!state.hasMore || state.isLoadingMore) return;

    state = state.copyWith(isLoadingMore: true);

    try {
      final nextPage = state.page + 1;
      final result = await _repo.listRecordings(page: nextPage, perPage: 20);

      state = state.copyWith(
        items: [...state.items, ...result.data],
        page: result.page,
        totalPages: result.totalPages,
        isLoadingMore: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoadingMore: false,
        error: extractErrorMessage(e),
      );
    }
  }

  Future<void> refresh() async {
    await load();
  }

  Future<void> getSignedUrl(String recordingId) async {
    state = state.copyWith(clearSignedUrl: true);

    try {
      final result = await _repo.getRecordingSignedUrl(recordingId);
      state = state.copyWith(
        signedUrl: result.url,
        signedUrlType: result.type,
      );
    } catch (e) {
      state = state.copyWith(
        error: extractErrorMessage(e),
      );
    }
  }
}

final recordingsProvider =
    StateNotifierProvider.autoDispose<RecordingsNotifier, RecordingsState>(
        (ref) {
  final repo = ref.watch(zoomRepositoryProvider);
  return RecordingsNotifier(repo);
});

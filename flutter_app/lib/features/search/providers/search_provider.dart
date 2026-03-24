import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/core/utils/error_utils.dart';
import 'package:ict_lms_student/data/repositories/search_repository.dart';
import 'package:ict_lms_student/models/search_result.dart';

class SearchState {
  final String query;
  final bool isLoading;
  final SearchResult? results;
  final String? error;

  const SearchState({
    this.query = '',
    this.isLoading = false,
    this.results,
    this.error,
  });

  SearchState copyWith({
    String? query,
    bool? isLoading,
    SearchResult? results,
    String? error,
    bool clearResults = false,
    bool clearError = false,
  }) {
    return SearchState(
      query: query ?? this.query,
      isLoading: isLoading ?? this.isLoading,
      results: clearResults ? null : (results ?? this.results),
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class SearchNotifier extends StateNotifier<SearchState> {
  final SearchRepository _repo;
  CancelToken? _cancelToken;

  SearchNotifier(this._repo) : super(const SearchState());

  Future<void> search(String query) async {
    final trimmed = query.trim();

    if (trimmed.isEmpty) {
      _cancelToken?.cancel('Search cleared');
      state = const SearchState();
      return;
    }

    // Cancel any in-flight request before starting a new one.
    _cancelToken?.cancel('New search started');
    _cancelToken = CancelToken();

    state = state.copyWith(
      query: trimmed,
      isLoading: true,
      clearError: true,
    );

    try {
      final results = await _repo.search(
        trimmed,
        limit: 10,
        cancelToken: _cancelToken,
      );
      // Only update if the query hasn't changed while we were fetching.
      if (state.query == trimmed) {
        state = state.copyWith(
          results: results,
          isLoading: false,
        );
      }
    } on DioException catch (e) {
      // Ignore intentionally cancelled requests.
      if (e.type == DioExceptionType.cancel) return;
      if (state.query == trimmed) {
        state = state.copyWith(
          isLoading: false,
          error: extractErrorMessage(e),
        );
      }
    } catch (e) {
      if (state.query == trimmed) {
        state = state.copyWith(
          isLoading: false,
          error: extractErrorMessage(e),
        );
      }
    }
  }

  void clear() {
    _cancelToken?.cancel('Search cleared');
    state = const SearchState();
  }

  @override
  void dispose() {
    _cancelToken?.cancel();
    super.dispose();
  }
}

final searchProvider =
    StateNotifierProvider.autoDispose<SearchNotifier, SearchState>((ref) {
  final repo = ref.watch(searchRepositoryProvider);
  return SearchNotifier(repo);
});

import 'package:flutter_riverpod/flutter_riverpod.dart';
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

  SearchNotifier(this._repo) : super(const SearchState());

  Future<void> search(String query) async {
    final trimmed = query.trim();

    if (trimmed.isEmpty) {
      state = const SearchState();
      return;
    }

    state = state.copyWith(
      query: trimmed,
      isLoading: true,
      clearError: true,
    );

    try {
      final results = await _repo.search(trimmed, limit: 10);
      // Only update if the query hasn't changed while we were fetching.
      if (state.query == trimmed) {
        state = state.copyWith(
          results: results,
          isLoading: false,
        );
      }
    } catch (e) {
      if (state.query == trimmed) {
        state = state.copyWith(
          isLoading: false,
          error: e.toString().replaceFirst('Exception: ', ''),
        );
      }
    }
  }

  void clear() {
    state = const SearchState();
  }
}

final searchProvider =
    StateNotifierProvider.autoDispose<SearchNotifier, SearchState>((ref) {
  final repo = ref.watch(searchRepositoryProvider);
  return SearchNotifier(repo);
});

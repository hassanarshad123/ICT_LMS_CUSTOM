import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/api_constants.dart';
import '../../core/network/api_client.dart';
import '../../models/search_result.dart';

class SearchRepository {
  final Dio _dio;

  SearchRepository(this._dio);

  /// GET /search?q=query&limit=limit
  ///
  /// Returns unified search results across courses, batches, and announcements.
  Future<SearchResult> search(
    String query, {
    int limit = 10,
    CancelToken? cancelToken,
  }) async {
    final response = await _dio.get(
      ApiConstants.search,
      queryParameters: <String, dynamic>{
        'q': query,
        'limit': limit,
      },
      cancelToken: cancelToken,
    );

    return SearchResult.fromJson(response.data as Map<String, dynamic>);
  }
}

final searchRepositoryProvider = Provider<SearchRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return SearchRepository(dio);
});

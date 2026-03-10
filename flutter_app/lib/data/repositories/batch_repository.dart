import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/api_constants.dart';
import '../../core/network/api_client.dart';
import '../../models/batch_out.dart';

class BatchRepository {
  final Dio _dio;

  BatchRepository(this._dio);

  /// GET /batches with optional filters.
  ///
  /// Students only see batches they are enrolled in (backend filters by user).
  /// Returns a map with 'data' (List<BatchOut>), 'total', 'page', 'perPage', 'totalPages'.
  Future<Map<String, dynamic>> listBatches({
    int page = 1,
    int perPage = 20,
    String? status,
    String? search,
  }) async {
    final queryParams = <String, dynamic>{
      'page': page,
      'per_page': perPage,
    };
    if (status != null) queryParams['status'] = status;
    if (search != null && search.isNotEmpty) queryParams['search'] = search;

    final response = await _dio.get(
      ApiConstants.batches,
      queryParameters: queryParams,
    );

    final data = response.data as Map<String, dynamic>;
    final items = (data['data'] as List<dynamic>?)
            ?.map((e) => BatchOut.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];

    return {
      'data': items,
      'total': data['total'] as int? ?? 0,
      'page': data['page'] as int? ?? 1,
      'perPage': data['perPage'] as int? ?? perPage,
      'totalPages': data['totalPages'] as int? ?? 0,
    };
  }

  /// GET /batches/{batchId}
  Future<BatchOut> getBatch(String batchId) async {
    final response = await _dio.get('${ApiConstants.batches}/$batchId');
    return BatchOut.fromJson(response.data as Map<String, dynamic>);
  }
}

final batchRepositoryProvider = Provider<BatchRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return BatchRepository(dio);
});

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/api_constants.dart';
import '../../core/network/api_client.dart';
import '../../models/batch_out.dart';
import '../../models/paginated_response.dart';

class BatchRepository {
  final Dio _dio;

  BatchRepository(this._dio);

  /// GET /batches with optional filters.
  ///
  /// Students only see batches they are enrolled in (backend filters by user).
  Future<PaginatedResponse<BatchOut>> listBatches({
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

    return PaginatedResponse.fromJson(
      response.data as Map<String, dynamic>,
      (json) => BatchOut.fromJson(json),
    );
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

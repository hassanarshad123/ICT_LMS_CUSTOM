import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/core/constants/api_constants.dart';
import 'package:ict_lms_student/core/network/api_client.dart';
import 'package:ict_lms_student/models/material_download_url.dart';
import 'package:ict_lms_student/models/material_out.dart';
import 'package:ict_lms_student/models/paginated_response.dart';

class MaterialRepository {
  final Dio _dio;

  MaterialRepository(this._dio);

  /// GET /materials?batch_id={batchId}&course_id={courseId}
  Future<PaginatedResponse<MaterialOut>> listMaterials({
    required String batchId,
    String? courseId,
    int page = 1,
    int perPage = 50,
  }) async {
    final queryParams = <String, dynamic>{
      'batch_id': batchId,
      'page': page,
      'per_page': perPage,
    };
    if (courseId != null) queryParams['course_id'] = courseId;

    final response = await _dio.get(
      ApiConstants.materials,
      queryParameters: queryParams,
    );

    return PaginatedResponse.fromJson(
      response.data as Map<String, dynamic>,
      (json) => MaterialOut.fromJson(json),
    );
  }

  /// GET /materials/{materialId}/download-url
  Future<MaterialDownloadUrl> getDownloadUrl(
      String materialId) async {
    final response =
        await _dio.get('${ApiConstants.materials}/$materialId/download-url');
    return MaterialDownloadUrl.fromJson(
        response.data as Map<String, dynamic>);
  }
}

final materialRepositoryProvider = Provider<MaterialRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return MaterialRepository(dio);
});

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/core/constants/api_constants.dart';
import 'package:ict_lms_student/core/network/api_client.dart';
import 'package:ict_lms_student/models/material_download_url.dart';
import 'package:ict_lms_student/models/material_out.dart';

class MaterialRepository {
  final Dio _dio;

  MaterialRepository(this._dio);

  /// GET /materials?batch_id={batchId}&course_id={courseId}
  Future<Map<String, dynamic>> listMaterials({
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

    final data = response.data as Map<String, dynamic>;
    final items = (data['data'] as List<dynamic>?)
            ?.map((e) => MaterialOut.fromJson(e as Map<String, dynamic>))
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

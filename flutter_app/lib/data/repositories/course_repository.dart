import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/core/constants/api_constants.dart';
import 'package:ict_lms_student/core/network/api_client.dart';
import 'package:ict_lms_student/models/course_out.dart';

class CourseRepository {
  final Dio _dio;

  CourseRepository(this._dio);

  /// GET /courses with optional filters.
  Future<Map<String, dynamic>> listCourses({
    int page = 1,
    int perPage = 20,
    String? batchId,
    String? status,
    String? search,
  }) async {
    final queryParams = <String, dynamic>{
      'page': page,
      'per_page': perPage,
    };
    if (batchId != null) queryParams['batch_id'] = batchId;
    if (status != null) queryParams['status'] = status;
    if (search != null && search.isNotEmpty) queryParams['search'] = search;

    final response = await _dio.get(
      ApiConstants.courses,
      queryParameters: queryParams,
    );

    final data = response.data as Map<String, dynamic>;
    final items = (data['data'] as List<dynamic>?)
            ?.map((e) => CourseOut.fromJson(e as Map<String, dynamic>))
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

  /// GET /courses/{courseId}
  Future<CourseOut> getCourse(String courseId) async {
    final response = await _dio.get('${ApiConstants.courses}/$courseId');
    return CourseOut.fromJson(response.data as Map<String, dynamic>);
  }
}

final courseRepositoryProvider = Provider<CourseRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return CourseRepository(dio);
});

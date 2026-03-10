import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/core/constants/api_constants.dart';
import 'package:ict_lms_student/core/network/api_client.dart';
import 'package:ict_lms_student/models/curriculum_module_out.dart';

class CurriculumRepository {
  final Dio _dio;

  CurriculumRepository(this._dio);

  /// GET /curriculum?course_id={courseId}
  /// Returns a plain list (not paginated).
  Future<List<CurriculumModuleOut>> listModules(String courseId) async {
    final response = await _dio.get(
      ApiConstants.curriculum,
      queryParameters: {'course_id': courseId},
    );

    final data = response.data as List<dynamic>;
    return data
        .map((e) => CurriculumModuleOut.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}

final curriculumRepositoryProvider = Provider<CurriculumRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return CurriculumRepository(dio);
});

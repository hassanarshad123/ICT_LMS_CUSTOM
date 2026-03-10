import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/core/constants/api_constants.dart';
import 'package:ict_lms_student/core/network/api_client.dart';
import 'package:ict_lms_student/models/lecture_out.dart';
import 'package:ict_lms_student/models/progress_out.dart';
import 'package:ict_lms_student/models/signed_url_response.dart';

class LectureRepository {
  final Dio _dio;

  LectureRepository(this._dio);

  /// GET /lectures?batch_id={batchId}&course_id={courseId}
  Future<Map<String, dynamic>> listLectures({
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
      ApiConstants.lectures,
      queryParameters: queryParams,
    );

    final data = response.data as Map<String, dynamic>;
    final items = (data['data'] as List<dynamic>?)
            ?.map((e) => LectureOut.fromJson(e as Map<String, dynamic>))
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

  /// GET /lectures/{lectureId}
  Future<LectureOut> getLecture(String lectureId) async {
    final response = await _dio.get('${ApiConstants.lectures}/$lectureId');
    return LectureOut.fromJson(response.data as Map<String, dynamic>);
  }

  /// POST /lectures/{lectureId}/signed-url
  Future<SignedUrlResponse> getSignedUrl(String lectureId) async {
    final response =
        await _dio.post('${ApiConstants.lectures}/$lectureId/signed-url');
    return SignedUrlResponse.fromJson(response.data as Map<String, dynamic>);
  }

  /// POST /lectures/{lectureId}/progress
  Future<ProgressOut> updateProgress({
    required String lectureId,
    required int watchPercentage,
    int resumePositionSeconds = 0,
  }) async {
    final response = await _dio.post(
      '${ApiConstants.lectures}/$lectureId/progress',
      data: {
        'watchPercentage': watchPercentage,
        'resumePositionSeconds': resumePositionSeconds,
      },
    );
    return ProgressOut.fromJson(response.data as Map<String, dynamic>);
  }

  /// GET /lectures/{lectureId}/progress
  Future<ProgressOut> getProgress(String lectureId) async {
    final response =
        await _dio.get('${ApiConstants.lectures}/$lectureId/progress');
    return ProgressOut.fromJson(response.data as Map<String, dynamic>);
  }
}

final lectureRepositoryProvider = Provider<LectureRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return LectureRepository(dio);
});

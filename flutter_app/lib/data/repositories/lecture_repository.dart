import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/core/constants/api_constants.dart';
import 'package:ict_lms_student/core/network/api_client.dart';
import 'package:ict_lms_student/models/lecture_out.dart';
import 'package:ict_lms_student/models/paginated_response.dart';
import 'package:ict_lms_student/models/progress_out.dart';
import 'package:ict_lms_student/models/signed_url_response.dart';

class LectureRepository {
  final Dio _dio;

  LectureRepository(this._dio);

  /// GET /lectures?batch_id={batchId}&course_id={courseId}
  Future<PaginatedResponse<LectureOut>> listLectures({
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

    return PaginatedResponse.fromJson(
      response.data as Map<String, dynamic>,
      (json) => LectureOut.fromJson(json),
    );
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

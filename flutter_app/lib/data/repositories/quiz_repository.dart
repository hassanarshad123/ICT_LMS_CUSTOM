import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/core/constants/api_constants.dart';
import 'package:ict_lms_student/core/network/api_client.dart';
import 'package:ict_lms_student/models/quiz_out.dart';
import 'package:ict_lms_student/models/quiz_question_out.dart';
import 'package:ict_lms_student/models/quiz_attempt_out.dart';

class QuizRepository {
  final Dio _dio;

  QuizRepository(this._dio);

  /// GET /quizzes?course_id=X → returns flat list (not paginated).
  Future<List<QuizOut>> listQuizzes({required String courseId}) async {
    final response = await _dio.get(
      ApiConstants.quizzes,
      queryParameters: {'course_id': courseId},
    );
    final list = (response.data as List<dynamic>)
        .map((e) => QuizOut.fromJson(e as Map<String, dynamic>))
        .toList();
    return list;
  }

  /// GET /quizzes/{quizId}/questions → student view (no correct_answer).
  Future<List<QuizQuestionOut>> getQuestions(String quizId) async {
    final response = await _dio.get(
      '${ApiConstants.quizzes}/$quizId/questions',
    );
    final list = (response.data as List<dynamic>)
        .map((e) => QuizQuestionOut.fromJson(e as Map<String, dynamic>))
        .toList();
    return list;
  }

  /// POST /quizzes/{quizId}/attempts → start a new attempt.
  Future<QuizAttemptOut> startAttempt(String quizId) async {
    final response = await _dio.post(
      '${ApiConstants.quizzes}/$quizId/attempts',
    );
    return QuizAttemptOut.fromJson(response.data as Map<String, dynamic>);
  }

  /// POST /quizzes/attempts/{attemptId}/submit → submit answers.
  Future<QuizAttemptOut> submitAttempt(
    String attemptId,
    List<Map<String, dynamic>> answers,
  ) async {
    final response = await _dio.post(
      '${ApiConstants.quizzes}/attempts/$attemptId/submit',
      data: {'answers': answers},
    );
    return QuizAttemptOut.fromJson(response.data as Map<String, dynamic>);
  }

  /// GET /quizzes/attempts/{attemptId} → attempt detail with answers.
  Future<QuizAttemptDetailOut> getAttemptDetail(String attemptId) async {
    final response = await _dio.get(
      '${ApiConstants.quizzes}/attempts/$attemptId',
    );
    return QuizAttemptDetailOut.fromJson(
      response.data as Map<String, dynamic>,
    );
  }

  /// GET /quizzes/my-attempts?course_id=X → student's own attempts.
  Future<List<QuizAttemptOut>> getMyAttempts({String? courseId}) async {
    final queryParams = <String, dynamic>{};
    if (courseId != null) queryParams['course_id'] = courseId;

    final response = await _dio.get(
      ApiConstants.myAttempts,
      queryParameters: queryParams,
    );
    final list = (response.data as List<dynamic>)
        .map((e) => QuizAttemptOut.fromJson(e as Map<String, dynamic>))
        .toList();
    return list;
  }
}

final quizRepositoryProvider = Provider<QuizRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return QuizRepository(dio);
});

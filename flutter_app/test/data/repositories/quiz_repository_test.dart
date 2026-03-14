import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ict_lms_student/data/repositories/quiz_repository.dart';
import 'package:ict_lms_student/models/quiz_out.dart';
import 'package:ict_lms_student/models/quiz_question_out.dart';
import 'package:ict_lms_student/models/quiz_attempt_out.dart';

/// Manual mock adapter for Dio.
class _MockAdapter implements HttpClientAdapter {
  late RequestOptions lastOptions;
  dynamic responseData;
  int statusCode;

  // ignore: unused_element_parameter
  _MockAdapter({this.responseData, this.statusCode = 200});

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    lastOptions = options;
    return ResponseBody.fromString(
      _encode(responseData),
      statusCode,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  String _encode(dynamic data) {
    if (data is String) return data;
    return _jsonEncode(data);
  }

  String _jsonEncode(dynamic data) {
    if (data == null) return 'null';
    if (data is String) return '"$data"';
    if (data is num || data is bool) return '$data';
    if (data is List) {
      return '[${data.map(_jsonEncode).join(',')}]';
    }
    if (data is Map) {
      final entries = data.entries
          .map((e) => '"${e.key}":${_jsonEncode(e.value)}')
          .join(',');
      return '{$entries}';
    }
    return '"$data"';
  }

  @override
  void close({bool force = false}) {}
}

/// Adapter that always throws a DioException.
class _ErrorAdapter implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    throw DioException(
      requestOptions: options,
      message: 'Network error',
      type: DioExceptionType.connectionError,
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  late Dio dio;
  late _MockAdapter adapter;
  late QuizRepository repo;

  setUp(() {
    adapter = _MockAdapter();
    dio = Dio(BaseOptions(baseUrl: 'https://test.api/api/v1'))
      ..httpClientAdapter = adapter;
    repo = QuizRepository(dio);
  });

  group('listQuizzes', () {
    test('sends GET /quizzes with course_id param', () async {
      adapter.responseData = [
        {
          'id': 'q1',
          'courseId': 'c1',
          'title': 'Quiz 1',
          'passPercentage': 50,
          'maxAttempts': 1,
          'isPublished': true,
          'sequenceOrder': 1,
          'questionCount': 5,
        },
      ];

      final result = await repo.listQuizzes(courseId: 'c1');

      expect(adapter.lastOptions.path, contains('/quizzes'));
      expect(adapter.lastOptions.queryParameters['course_id'], 'c1');
      expect(result, hasLength(1));
      expect(result.first, isA<QuizOut>());
      expect(result.first.title, 'Quiz 1');
    });

    test('returns empty list when no quizzes', () async {
      adapter.responseData = [];
      final result = await repo.listQuizzes(courseId: 'c1');
      expect(result, isEmpty);
    });
  });

  group('getQuestions', () {
    test('sends GET /quizzes/{quizId}/questions', () async {
      adapter.responseData = [
        {
          'id': 'qn1',
          'quizId': 'q1',
          'questionType': 'mcq',
          'questionText': 'What?',
          'options': {'a': '1', 'b': '2'},
          'points': 1,
          'sequenceOrder': 1,
        },
      ];

      final result = await repo.getQuestions('q1');

      expect(adapter.lastOptions.path, contains('/quizzes/q1/questions'));
      expect(result, hasLength(1));
      expect(result.first, isA<QuizQuestionOut>());
      expect(result.first.questionType, 'mcq');
    });
  });

  group('startAttempt', () {
    test('sends POST /quizzes/{quizId}/attempts', () async {
      adapter.responseData = {
        'id': 'att1',
        'quizId': 'q1',
        'studentId': 's1',
        'status': 'in_progress',
        'startedAt': '2026-03-01T10:00:00.000Z',
      };

      final result = await repo.startAttempt('q1');

      expect(adapter.lastOptions.path, contains('/quizzes/q1/attempts'));
      expect(adapter.lastOptions.method, 'POST');
      expect(result, isA<QuizAttemptOut>());
      expect(result.status, 'in_progress');
    });
  });

  group('submitAttempt', () {
    test('sends POST /quizzes/attempts/{id}/submit with answers', () async {
      adapter.responseData = {
        'id': 'att1',
        'quizId': 'q1',
        'studentId': 's1',
        'status': 'graded',
        'score': 8,
        'maxScore': 10,
        'percentage': 80,
        'passed': true,
      };

      final answers = [
        {'questionId': 'qn1', 'answerText': 'b'},
        {'questionId': 'qn2', 'answerText': 'true'},
      ];
      final result = await repo.submitAttempt('att1', answers);

      expect(adapter.lastOptions.path, contains('/quizzes/attempts/att1/submit'));
      expect(adapter.lastOptions.method, 'POST');
      expect(result, isA<QuizAttemptOut>());
      expect(result.passed, true);
    });
  });

  group('getAttemptDetail', () {
    test('sends GET /quizzes/attempts/{id}', () async {
      adapter.responseData = {
        'id': 'att1',
        'quizId': 'q1',
        'studentId': 's1',
        'status': 'graded',
        'answers': [
          {'id': 'ans1', 'questionId': 'qn1', 'answerText': 'b', 'isCorrect': true, 'pointsAwarded': 2},
        ],
      };

      final result = await repo.getAttemptDetail('att1');

      expect(adapter.lastOptions.path, contains('/quizzes/attempts/att1'));
      expect(result, isA<QuizAttemptDetailOut>());
      expect(result.answers, hasLength(1));
      expect(result.answers.first.isCorrect, true);
    });
  });

  group('getMyAttempts', () {
    test('sends GET /quizzes/my-attempts with optional course_id', () async {
      adapter.responseData = [
        {
          'id': 'att1',
          'quizId': 'q1',
          'studentId': 's1',
          'status': 'graded',
          'score': 8,
          'maxScore': 10,
          'percentage': 80,
          'passed': true,
        },
      ];

      final result = await repo.getMyAttempts(courseId: 'c1');

      expect(adapter.lastOptions.path, contains('/quizzes/my-attempts'));
      expect(adapter.lastOptions.queryParameters['course_id'], 'c1');
      expect(result, hasLength(1));
      expect(result.first, isA<QuizAttemptOut>());
    });

    test('sends without course_id when null', () async {
      adapter.responseData = [];
      await repo.getMyAttempts();
      expect(adapter.lastOptions.queryParameters.containsKey('course_id'), false);
    });
  });

  group('error propagation', () {
    test('listQuizzes propagates DioException', () async {
      final errorDio = Dio(BaseOptions(baseUrl: 'https://test.api/api/v1'))
        ..httpClientAdapter = _ErrorAdapter();
      final errorRepo = QuizRepository(errorDio);

      expect(
        () => errorRepo.listQuizzes(courseId: 'c1'),
        throwsA(isA<DioException>()),
      );
    });

    test('startAttempt propagates DioException', () async {
      final errorDio = Dio(BaseOptions(baseUrl: 'https://test.api/api/v1'))
        ..httpClientAdapter = _ErrorAdapter();
      final errorRepo = QuizRepository(errorDio);

      expect(
        () => errorRepo.startAttempt('q1'),
        throwsA(isA<DioException>()),
      );
    });
  });
}

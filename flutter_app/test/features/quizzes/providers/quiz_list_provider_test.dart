import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/data/repositories/quiz_repository.dart';
import 'package:ict_lms_student/features/quizzes/providers/quiz_list_provider.dart';
import 'package:ict_lms_student/models/quiz_out.dart';

/// Fake repository for testing.
class _FakeQuizRepository extends QuizRepository {
  List<QuizOut>? quizzesToReturn;
  Exception? errorToThrow;

  _FakeQuizRepository() : super(_unusedDio());

  @override
  Future<List<QuizOut>> listQuizzes({required String courseId}) async {
    if (errorToThrow != null) throw errorToThrow!;
    return quizzesToReturn ?? [];
  }
}

// Use a real Dio instance — the fake repo overrides all methods so it's never called.
Dio _unusedDio() => Dio();

void main() {
  group('quizListProvider', () {
    test('returns quizzes from repository', () async {
      final fakeRepo = _FakeQuizRepository();
      fakeRepo.quizzesToReturn = [
        QuizOut.fromJson({
          'id': 'q1',
          'courseId': 'c1',
          'title': 'Quiz 1',
          'passPercentage': 50,
          'maxAttempts': 1,
          'isPublished': true,
          'sequenceOrder': 1,
          'questionCount': 5,
        }),
      ];

      final container = ProviderContainer(
        overrides: [
          quizRepositoryProvider.overrideWithValue(fakeRepo),
        ],
      );
      addTearDown(container.dispose);

      final result = await container.read(quizListProvider('c1').future);
      expect(result, hasLength(1));
      expect(result.first.title, 'Quiz 1');
    });

    test('returns empty list when no quizzes', () async {
      final fakeRepo = _FakeQuizRepository();
      fakeRepo.quizzesToReturn = [];

      final container = ProviderContainer(
        overrides: [
          quizRepositoryProvider.overrideWithValue(fakeRepo),
        ],
      );
      addTearDown(container.dispose);

      final result = await container.read(quizListProvider('c1').future);
      expect(result, isEmpty);
    });

    test('propagates errors', () async {
      final fakeRepo = _FakeQuizRepository();
      fakeRepo.errorToThrow = Exception('Network error');

      final container = ProviderContainer(
        overrides: [
          quizRepositoryProvider.overrideWithValue(fakeRepo),
        ],
      );
      addTearDown(container.dispose);

      expect(
        () => container.read(quizListProvider('c1').future),
        throwsA(isA<Exception>()),
      );
    });
  });
}

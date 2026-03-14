import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/data/repositories/quiz_repository.dart';
import 'package:ict_lms_student/features/quizzes/providers/quiz_result_provider.dart';
import 'package:ict_lms_student/models/quiz_attempt_out.dart';
import 'package:ict_lms_student/models/quiz_question_out.dart';

class _FakeQuizRepository extends QuizRepository {
  QuizAttemptDetailOut? detailToReturn;
  List<QuizQuestionOut>? questionsToReturn;
  Exception? errorToThrow;

  _FakeQuizRepository() : super(_unusedDio());

  @override
  Future<QuizAttemptDetailOut> getAttemptDetail(String attemptId) async {
    if (errorToThrow != null) throw errorToThrow!;
    return detailToReturn!;
  }

  @override
  Future<List<QuizQuestionOut>> getQuestions(String quizId) async {
    if (errorToThrow != null) throw errorToThrow!;
    return questionsToReturn ?? [];
  }
}

Dio _unusedDio() => Dio();

void main() {
  group('quizResultProvider', () {
    test('fetches attempt detail and questions in parallel', () async {
      final fakeRepo = _FakeQuizRepository();
      fakeRepo.detailToReturn = QuizAttemptDetailOut.fromJson({
        'id': 'att1',
        'quizId': 'q1',
        'studentId': 's1',
        'status': 'graded',
        'score': 8,
        'maxScore': 10,
        'percentage': 80,
        'passed': true,
        'answers': [
          {'id': 'ans1', 'questionId': 'qn1', 'answerText': 'b', 'isCorrect': true, 'pointsAwarded': 5},
        ],
      });
      fakeRepo.questionsToReturn = [
        QuizQuestionOut.fromJson({
          'id': 'qn1',
          'quizId': 'q1',
          'questionType': 'mcq',
          'questionText': 'What?',
          'options': {'a': '1', 'b': '2'},
          'points': 5,
          'sequenceOrder': 1,
        }),
      ];

      final container = ProviderContainer(
        overrides: [
          quizRepositoryProvider.overrideWithValue(fakeRepo),
        ],
      );
      addTearDown(container.dispose);

      final params = (attemptId: 'att1', quizId: 'q1');
      final result = await container.read(quizResultProvider(params).future);

      expect(result.attempt.score, 8);
      expect(result.attempt.answers, hasLength(1));
      expect(result.questions, hasLength(1));
      expect(result.questions.first.questionText, 'What?');
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

      final params = (attemptId: 'att1', quizId: 'q1');
      expect(
        () => container.read(quizResultProvider(params).future),
        throwsA(isA<Exception>()),
      );
    });
  });
}

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ict_lms_student/features/quizzes/providers/quiz_attempt_provider.dart';
import 'package:ict_lms_student/data/repositories/quiz_repository.dart';
import 'package:ict_lms_student/models/quiz_out.dart';
import 'package:ict_lms_student/models/quiz_question_out.dart';
import 'package:ict_lms_student/models/quiz_attempt_out.dart';

class _FakeQuizRepository extends QuizRepository {
  List<QuizQuestionOut> questionsToReturn = [];
  QuizAttemptOut? attemptToReturn;
  QuizAttemptOut? submitResult;
  Exception? errorToThrow;

  _FakeQuizRepository() : super(_unusedDio());

  @override
  Future<List<QuizQuestionOut>> getQuestions(String quizId) async {
    if (errorToThrow != null) throw errorToThrow!;
    return questionsToReturn;
  }

  @override
  Future<QuizAttemptOut> startAttempt(String quizId) async {
    if (errorToThrow != null) throw errorToThrow!;
    return attemptToReturn ??
        QuizAttemptOut.fromJson({
          'id': 'att-1',
          'quizId': quizId,
          'studentId': 's1',
          'status': 'in_progress',
        });
  }

  @override
  Future<QuizAttemptOut> submitAttempt(
    String attemptId,
    List<Map<String, dynamic>> answers,
  ) async {
    if (errorToThrow != null) throw errorToThrow!;
    return submitResult ??
        QuizAttemptOut.fromJson({
          'id': attemptId,
          'quizId': 'q1',
          'studentId': 's1',
          'status': 'graded',
          'score': 8,
          'maxScore': 10,
          'percentage': 80,
          'passed': true,
        });
  }
}

Dio _unusedDio() => Dio();

QuizOut _makeQuiz({int? timeLimitMinutes}) => QuizOut.fromJson({
      'id': 'q1',
      'courseId': 'c1',
      'title': 'Test Quiz',
      'passPercentage': 50,
      'maxAttempts': 3,
      'isPublished': true,
      'sequenceOrder': 1,
      'questionCount': 2,
      'timeLimitMinutes': timeLimitMinutes,
    });

List<QuizQuestionOut> _makeQuestions() => [
      QuizQuestionOut.fromJson({
        'id': 'qn1',
        'quizId': 'q1',
        'questionType': 'mcq',
        'questionText': 'What is 2+2?',
        'options': {'a': '3', 'b': '4', 'c': '5', 'd': '6'},
        'points': 5,
        'sequenceOrder': 1,
      }),
      QuizQuestionOut.fromJson({
        'id': 'qn2',
        'quizId': 'q1',
        'questionType': 'true_false',
        'questionText': 'Sky is blue?',
        'points': 5,
        'sequenceOrder': 2,
      }),
    ];

void main() {
  group('QuizTakingNotifier', () {
    late _FakeQuizRepository fakeRepo;

    setUp(() {
      fakeRepo = _FakeQuizRepository();
      fakeRepo.questionsToReturn = _makeQuestions();
    });

    QuizTakingNotifier createNotifier() {
      return QuizTakingNotifier(fakeRepo);
    }

    test('initial state is correct', () {
      final notifier = createNotifier();
      final state = notifier.state;
      expect(state.quiz, isNull);
      expect(state.questions, isEmpty);
      expect(state.answers, isEmpty);
      expect(state.isLoading, false);
      expect(state.isSubmitted, false);
      expect(state.isSubmitting, false);
    });

    test('loadQuiz populates questions and starts attempt', () async {
      final notifier = createNotifier();
      await notifier.loadQuiz(_makeQuiz());

      expect(notifier.state.quiz, isNotNull);
      expect(notifier.state.questions, hasLength(2));
      expect(notifier.state.attemptId, 'att-1');
      expect(notifier.state.answers, isEmpty);
      expect(notifier.state.isLoading, false);
    });

    test('loadQuiz initializes timer for timed quiz', () async {
      final notifier = createNotifier();
      await notifier.loadQuiz(_makeQuiz(timeLimitMinutes: 10));

      expect(notifier.state.remainingSeconds, isNotNull);
      expect(notifier.state.remainingSeconds, greaterThanOrEqualTo(599));
      notifier.dispose();
    });

    test('loadQuiz sets no timer for untimed quiz', () async {
      final notifier = createNotifier();
      await notifier.loadQuiz(_makeQuiz());

      expect(notifier.state.remainingSeconds, isNull);
    });

    test('loadQuiz sets error on failure', () async {
      fakeRepo.errorToThrow = Exception('Failed');
      final notifier = createNotifier();
      await notifier.loadQuiz(_makeQuiz());

      expect(notifier.state.error, isNotNull);
      expect(notifier.state.isLoading, false);
    });

    test('setAnswer updates answer for questionId', () async {
      final notifier = createNotifier();
      await notifier.loadQuiz(_makeQuiz());
      notifier.setAnswer('qn1', 'b');

      expect(notifier.state.answers['qn1'], 'b');
      expect(notifier.state.answers.containsKey('qn2'), false);
    });

    test('setAnswer preserves other answers', () async {
      final notifier = createNotifier();
      await notifier.loadQuiz(_makeQuiz());
      notifier.setAnswer('qn1', 'b');
      notifier.setAnswer('qn2', 'true');

      expect(notifier.state.answers['qn1'], 'b');
      expect(notifier.state.answers['qn2'], 'true');
    });

    test('clearAnswer removes answer', () async {
      final notifier = createNotifier();
      await notifier.loadQuiz(_makeQuiz());
      notifier.setAnswer('qn1', 'b');
      notifier.clearAnswer('qn1');

      expect(notifier.state.answers.containsKey('qn1'), false);
    });

    test('answeredCount counts non-empty answers', () async {
      final notifier = createNotifier();
      await notifier.loadQuiz(_makeQuiz());
      expect(notifier.answeredCount, 0);

      notifier.setAnswer('qn1', 'b');
      expect(notifier.answeredCount, 1);

      notifier.setAnswer('qn2', 'true');
      expect(notifier.answeredCount, 2);
    });

    test('goToPage updates currentPage', () async {
      final notifier = createNotifier();
      await notifier.loadQuiz(_makeQuiz());
      notifier.goToPage(1);

      expect(notifier.state.currentPage, 1);
    });

    test('submitQuiz calls repo and sets isSubmitted', () async {
      final notifier = createNotifier();
      await notifier.loadQuiz(_makeQuiz());
      notifier.setAnswer('qn1', 'b');
      notifier.setAnswer('qn2', 'true');

      await notifier.submitQuiz();

      expect(notifier.state.isSubmitted, true);
      expect(notifier.state.result, isNotNull);
      expect(notifier.state.result!.passed, true);
    });

    test('submitQuiz prevents double-submit', () async {
      final notifier = createNotifier();
      await notifier.loadQuiz(_makeQuiz());
      notifier.setAnswer('qn1', 'b');

      await notifier.submitQuiz();
      final firstResult = notifier.state.result;

      // Try again
      await notifier.submitQuiz();
      expect(notifier.state.result, equals(firstResult));
    });

    test('submitQuiz sets error on failure', () async {
      final notifier = createNotifier();
      await notifier.loadQuiz(_makeQuiz());
      notifier.setAnswer('qn1', 'b');

      fakeRepo.errorToThrow = Exception('Submit failed');
      await notifier.submitQuiz();

      expect(notifier.state.error, isNotNull);
      expect(notifier.state.isSubmitting, false);
      // isSubmitted should NOT be true on failure
      expect(notifier.state.isSubmitted, false);
    });
  });
}

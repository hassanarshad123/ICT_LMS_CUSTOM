import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ict_lms_student/data/repositories/quiz_repository.dart';
import 'package:ict_lms_student/features/quizzes/screens/quiz_results_screen.dart';
import 'package:ict_lms_student/models/quiz_attempt_out.dart';
import 'package:ict_lms_student/models/quiz_question_out.dart';

class _FakeQuizRepository extends QuizRepository {
  QuizAttemptDetailOut? detailToReturn;
  List<QuizQuestionOut>? questionsToReturn;

  _FakeQuizRepository() : super(Dio());

  @override
  Future<QuizAttemptDetailOut> getAttemptDetail(String attemptId) async {
    return detailToReturn!;
  }

  @override
  Future<List<QuizQuestionOut>> getQuestions(String quizId) async {
    return questionsToReturn ?? [];
  }
}

void main() {
  group('QuizResultsScreen', () {
    testWidgets('shows loading initially', (tester) async {
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
        'answers': [],
      });
      fakeRepo.questionsToReturn = [];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            quizRepositoryProvider.overrideWithValue(fakeRepo),
          ],
          child: const MaterialApp(
            home: QuizResultsScreen(quizId: 'q1', attemptId: 'att1'),
          ),
        ),
      );

      // Initially loading
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('shows score gauge after loading', (tester) async {
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
          'questionText': 'What is 2+2?',
          'options': {'a': '3', 'b': '4'},
          'points': 5,
          'sequenceOrder': 1,
        }),
      ];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            quizRepositoryProvider.overrideWithValue(fakeRepo),
          ],
          child: const MaterialApp(
            home: QuizResultsScreen(quizId: 'q1', attemptId: 'att1'),
          ),
        ),
      );

      await tester.pumpAndSettle();
      expect(find.text('Quiz Results'), findsOneWidget);
      expect(find.textContaining('8'), findsWidgets);
    });

    testWidgets('shows pending review badge for submitted status', (tester) async {
      final fakeRepo = _FakeQuizRepository();
      fakeRepo.detailToReturn = QuizAttemptDetailOut.fromJson({
        'id': 'att1',
        'quizId': 'q1',
        'studentId': 's1',
        'status': 'submitted',
        'answers': [],
      });
      fakeRepo.questionsToReturn = [];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            quizRepositoryProvider.overrideWithValue(fakeRepo),
          ],
          child: const MaterialApp(
            home: QuizResultsScreen(quizId: 'q1', attemptId: 'att1'),
          ),
        ),
      );

      await tester.pumpAndSettle();
      expect(find.textContaining('Pending'), findsWidgets);
    });
  });
}

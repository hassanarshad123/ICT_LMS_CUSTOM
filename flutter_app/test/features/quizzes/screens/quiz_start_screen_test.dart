import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ict_lms_student/data/repositories/quiz_repository.dart';
import 'package:ict_lms_student/features/quizzes/screens/quiz_start_screen.dart';
import 'package:ict_lms_student/models/quiz_out.dart';
import 'package:ict_lms_student/models/quiz_attempt_out.dart';

class _FakeQuizRepository extends QuizRepository {
  List<QuizOut> quizzes = [];
  List<QuizAttemptOut> attempts = [];

  _FakeQuizRepository() : super(Dio());

  @override
  Future<List<QuizOut>> listQuizzes({required String courseId}) async {
    return quizzes;
  }

  @override
  Future<List<QuizAttemptOut>> getMyAttempts({String? courseId}) async {
    return attempts;
  }
}

void main() {
  group('QuizStartScreen', () {
    testWidgets('shows quiz title and description', (tester) async {
      final fakeRepo = _FakeQuizRepository();
      fakeRepo.quizzes = [
        QuizOut.fromJson({
          'id': 'q1',
          'courseId': 'c1',
          'title': 'Midterm Quiz',
          'description': 'Test your knowledge of chapters 1-5',
          'timeLimitMinutes': 30,
          'passPercentage': 70,
          'maxAttempts': 3,
          'isPublished': true,
          'sequenceOrder': 1,
          'questionCount': 10,
        }),
      ];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            quizRepositoryProvider.overrideWithValue(fakeRepo),
          ],
          child: const MaterialApp(
            home: QuizStartScreen(courseId: 'c1', quizId: 'q1'),
          ),
        ),
      );

      await tester.pumpAndSettle();
      expect(find.text('Midterm Quiz'), findsWidgets);
      expect(find.text('Test your knowledge of chapters 1-5'), findsOneWidget);
    });

    testWidgets('shows start button', (tester) async {
      final fakeRepo = _FakeQuizRepository();
      fakeRepo.quizzes = [
        QuizOut.fromJson({
          'id': 'q1',
          'courseId': 'c1',
          'title': 'Quiz',
          'passPercentage': 50,
          'maxAttempts': 3,
          'isPublished': true,
          'sequenceOrder': 1,
          'questionCount': 5,
        }),
      ];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            quizRepositoryProvider.overrideWithValue(fakeRepo),
          ],
          child: const MaterialApp(
            home: QuizStartScreen(courseId: 'c1', quizId: 'q1'),
          ),
        ),
      );

      await tester.pumpAndSettle();
      expect(find.text('Start Quiz'), findsOneWidget);
    });

    testWidgets('shows previous attempts', (tester) async {
      final fakeRepo = _FakeQuizRepository();
      fakeRepo.quizzes = [
        QuizOut.fromJson({
          'id': 'q1',
          'courseId': 'c1',
          'title': 'Quiz',
          'passPercentage': 50,
          'maxAttempts': 3,
          'isPublished': true,
          'sequenceOrder': 1,
          'questionCount': 5,
        }),
      ];
      fakeRepo.attempts = [
        QuizAttemptOut.fromJson({
          'id': 'att1',
          'quizId': 'q1',
          'studentId': 's1',
          'status': 'graded',
          'score': 8,
          'maxScore': 10,
          'percentage': 80,
          'passed': true,
          'startedAt': '2026-03-01T10:00:00.000Z',
        }),
      ];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            quizRepositoryProvider.overrideWithValue(fakeRepo),
          ],
          child: const MaterialApp(
            home: QuizStartScreen(courseId: 'c1', quizId: 'q1'),
          ),
        ),
      );

      await tester.pumpAndSettle();
      expect(find.textContaining('80%'), findsWidgets);
    });
  });
}

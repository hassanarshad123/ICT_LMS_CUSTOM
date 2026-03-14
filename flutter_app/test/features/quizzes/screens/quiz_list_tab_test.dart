import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ict_lms_student/data/repositories/quiz_repository.dart';
import 'package:ict_lms_student/features/quizzes/screens/quiz_list_tab.dart';
import 'package:ict_lms_student/models/quiz_out.dart';

class _FakeQuizRepository extends QuizRepository {
  List<QuizOut>? quizzesToReturn;
  Exception? errorToThrow;

  _FakeQuizRepository() : super(Dio());

  @override
  Future<List<QuizOut>> listQuizzes({required String courseId}) async {
    if (errorToThrow != null) throw errorToThrow!;
    return quizzesToReturn ?? [];
  }
}

void main() {
  group('QuizListTab', () {
    testWidgets('shows loading initially', (tester) async {
      final fakeRepo = _FakeQuizRepository();
      // Delay response to observe loading
      fakeRepo.quizzesToReturn = [];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            quizRepositoryProvider.overrideWithValue(fakeRepo),
          ],
          child: const MaterialApp(
            home: Scaffold(body: QuizListTab(courseId: 'c1')),
          ),
        ),
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('shows empty state when no quizzes', (tester) async {
      final fakeRepo = _FakeQuizRepository();
      fakeRepo.quizzesToReturn = [];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            quizRepositoryProvider.overrideWithValue(fakeRepo),
          ],
          child: const MaterialApp(
            home: Scaffold(body: QuizListTab(courseId: 'c1')),
          ),
        ),
      );

      await tester.pumpAndSettle();
      expect(find.textContaining('No quizzes'), findsOneWidget);
    });

    testWidgets('renders quiz cards when data loaded', (tester) async {
      final fakeRepo = _FakeQuizRepository();
      fakeRepo.quizzesToReturn = [
        QuizOut.fromJson({
          'id': 'q1',
          'courseId': 'c1',
          'title': 'Midterm Quiz',
          'passPercentage': 70,
          'maxAttempts': 3,
          'isPublished': true,
          'sequenceOrder': 1,
          'questionCount': 10,
        }),
        QuizOut.fromJson({
          'id': 'q2',
          'courseId': 'c1',
          'title': 'Final Quiz',
          'passPercentage': 50,
          'maxAttempts': 1,
          'isPublished': true,
          'sequenceOrder': 2,
          'questionCount': 20,
        }),
      ];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            quizRepositoryProvider.overrideWithValue(fakeRepo),
          ],
          child: const MaterialApp(
            home: Scaffold(body: QuizListTab(courseId: 'c1')),
          ),
        ),
      );

      await tester.pumpAndSettle();
      expect(find.text('Midterm Quiz'), findsOneWidget);
      expect(find.text('Final Quiz'), findsOneWidget);
    });
  });
}

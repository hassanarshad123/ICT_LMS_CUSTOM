import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ict_lms_student/data/repositories/quiz_repository.dart';
import 'package:ict_lms_student/features/quizzes/providers/quiz_attempt_provider.dart';
import 'package:ict_lms_student/features/quizzes/screens/quiz_taking_screen.dart';
import 'package:ict_lms_student/models/quiz_out.dart';
import 'package:ict_lms_student/models/quiz_question_out.dart';

class _FakeNotifier extends QuizTakingNotifier {
  final QuizTakingState _initialState;

  _FakeNotifier(this._initialState) : super(_FakeRepo()) {
    state = _initialState;
  }
}

class _FakeRepo extends QuizRepository {
  _FakeRepo() : super(Dio());
}

void main() {
  group('QuizTakingScreen', () {
    final loadedState = QuizTakingState(
      quiz: QuizOut.fromJson({
        'id': 'q1',
        'courseId': 'c1',
        'title': 'Test Quiz',
        'passPercentage': 50,
        'maxAttempts': 3,
        'isPublished': true,
        'sequenceOrder': 1,
        'questionCount': 2,
      }),
      questions: [
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
      ],
      attemptId: 'att-1',
    );

    testWidgets('shows loading when state is loading', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            quizTakingProvider.overrideWith(
              (ref) => _FakeNotifier(const QuizTakingState(isLoading: true)),
            ),
          ],
          child: const MaterialApp(
            home: QuizTakingScreen(courseId: 'c1', quizId: 'q1'),
          ),
        ),
      );
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('shows quiz title in app bar', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            quizTakingProvider.overrideWith(
              (ref) => _FakeNotifier(loadedState),
            ),
          ],
          child: const MaterialApp(
            home: QuizTakingScreen(courseId: 'c1', quizId: 'q1'),
          ),
        ),
      );
      expect(find.text('Test Quiz'), findsOneWidget);
    });

    testWidgets('renders PageView with questions', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            quizTakingProvider.overrideWith(
              (ref) => _FakeNotifier(loadedState),
            ),
          ],
          child: const MaterialApp(
            home: QuizTakingScreen(courseId: 'c1', quizId: 'q1'),
          ),
        ),
      );
      expect(find.byType(PageView), findsOneWidget);
      expect(find.text('What is 2+2?'), findsOneWidget);
    });

    testWidgets('shows submit button', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            quizTakingProvider.overrideWith(
              (ref) => _FakeNotifier(loadedState),
            ),
          ],
          child: const MaterialApp(
            home: QuizTakingScreen(courseId: 'c1', quizId: 'q1'),
          ),
        ),
      );
      expect(find.text('Submit'), findsOneWidget);
    });
  });
}

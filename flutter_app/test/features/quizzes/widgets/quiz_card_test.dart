import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ict_lms_student/features/quizzes/widgets/quiz_card.dart';
import 'package:ict_lms_student/models/quiz_out.dart';

void main() {
  Widget buildTestWidget({required QuizOut quiz, VoidCallback? onTap}) {
    return MaterialApp(
      home: Scaffold(
        body: QuizCard(quiz: quiz, onTap: onTap ?? () {}),
      ),
    );
  }

  final quiz = QuizOut.fromJson({
    'id': 'q1',
    'courseId': 'c1',
    'title': 'Midterm Quiz',
    'description': 'Test your knowledge',
    'timeLimitMinutes': 30,
    'passPercentage': 70,
    'maxAttempts': 3,
    'isPublished': true,
    'sequenceOrder': 1,
    'questionCount': 10,
  });

  group('QuizCard', () {
    testWidgets('renders title', (tester) async {
      await tester.pumpWidget(buildTestWidget(quiz: quiz));
      expect(find.text('Midterm Quiz'), findsOneWidget);
    });

    testWidgets('renders question count', (tester) async {
      await tester.pumpWidget(buildTestWidget(quiz: quiz));
      expect(find.textContaining('10'), findsWidgets);
    });

    testWidgets('renders time limit', (tester) async {
      await tester.pumpWidget(buildTestWidget(quiz: quiz));
      expect(find.textContaining('30'), findsWidgets);
    });

    testWidgets('renders pass percentage', (tester) async {
      await tester.pumpWidget(buildTestWidget(quiz: quiz));
      expect(find.textContaining('70%'), findsOneWidget);
    });

    testWidgets('renders max attempts', (tester) async {
      await tester.pumpWidget(buildTestWidget(quiz: quiz));
      expect(find.textContaining('3'), findsWidgets);
    });

    testWidgets('calls onTap when tapped', (tester) async {
      var tapped = false;
      await tester.pumpWidget(
        buildTestWidget(quiz: quiz, onTap: () => tapped = true),
      );
      await tester.tap(find.byType(QuizCard));
      expect(tapped, true);
    });

    testWidgets('hides time limit when null', (tester) async {
      final untimedQuiz = QuizOut.fromJson({
        'id': 'q2',
        'courseId': 'c1',
        'title': 'Untimed',
        'passPercentage': 50,
        'maxAttempts': 1,
        'isPublished': true,
        'sequenceOrder': 1,
        'questionCount': 5,
      });
      await tester.pumpWidget(buildTestWidget(quiz: untimedQuiz));
      expect(find.textContaining('No time limit'), findsOneWidget);
    });
  });
}

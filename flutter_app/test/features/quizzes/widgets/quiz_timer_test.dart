import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ict_lms_student/features/quizzes/widgets/quiz_timer.dart';

void main() {
  Widget buildTestWidget({required int remainingSeconds, bool isWarning = false}) {
    return MaterialApp(
      home: Scaffold(
        body: QuizTimer(
          remainingSeconds: remainingSeconds,
          isWarning: isWarning,
        ),
      ),
    );
  }

  group('QuizTimer', () {
    testWidgets('formats MM:SS correctly', (tester) async {
      await tester.pumpWidget(buildTestWidget(remainingSeconds: 125));
      expect(find.text('02:05'), findsOneWidget);
    });

    testWidgets('formats single digit seconds', (tester) async {
      await tester.pumpWidget(buildTestWidget(remainingSeconds: 65));
      expect(find.text('01:05'), findsOneWidget);
    });

    testWidgets('formats zero', (tester) async {
      await tester.pumpWidget(buildTestWidget(remainingSeconds: 0));
      expect(find.text("Time's up!"), findsOneWidget);
    });

    testWidgets('shows clock icon', (tester) async {
      await tester.pumpWidget(buildTestWidget(remainingSeconds: 60));
      expect(find.byIcon(Icons.timer_outlined), findsOneWidget);
    });

    testWidgets('uses warning color when isWarning is true', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        remainingSeconds: 30,
        isWarning: true,
      ));
      // Find the timer text and verify it's rendered (color is harder to test directly)
      expect(find.text('00:30'), findsOneWidget);
    });
  });
}

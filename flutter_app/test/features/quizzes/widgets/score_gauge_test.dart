import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ict_lms_student/features/quizzes/widgets/score_gauge.dart';

void main() {
  Widget buildTestWidget({int? percentage, bool? passed}) {
    return MaterialApp(
      home: Scaffold(
        body: Center(
          child: ScoreGauge(percentage: percentage, passed: passed),
        ),
      ),
    );
  }

  group('ScoreGauge', () {
    testWidgets('renders percentage text', (tester) async {
      await tester.pumpWidget(buildTestWidget(percentage: 80, passed: true));
      await tester.pumpAndSettle();
      expect(find.text('80%'), findsOneWidget);
    });

    testWidgets('renders pass label when passed', (tester) async {
      await tester.pumpWidget(buildTestWidget(percentage: 80, passed: true));
      await tester.pumpAndSettle();
      expect(find.text('Passed'), findsOneWidget);
    });

    testWidgets('renders fail label when failed', (tester) async {
      await tester.pumpWidget(buildTestWidget(percentage: 30, passed: false));
      await tester.pumpAndSettle();
      expect(find.text('Failed'), findsOneWidget);
    });

    testWidgets('handles null percentage', (tester) async {
      await tester.pumpWidget(buildTestWidget(percentage: null, passed: null));
      await tester.pumpAndSettle();
      expect(find.text('Pending'), findsOneWidget);
    });

    testWidgets('renders CustomPaint for gauge', (tester) async {
      await tester.pumpWidget(buildTestWidget(percentage: 50, passed: true));
      await tester.pumpAndSettle();
      expect(find.byType(CustomPaint), findsWidgets);
    });
  });
}

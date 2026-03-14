import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ict_lms_student/features/quizzes/widgets/question_swipe_card.dart';
import 'package:ict_lms_student/models/quiz_question_out.dart';

void main() {
  Widget buildTestWidget({
    required QuizQuestionOut question,
    required int questionNumber,
    required int totalQuestions,
    String? selectedAnswer,
    ValueChanged<String>? onAnswerChanged,
  }) {
    return MaterialApp(
      home: Scaffold(
        body: SizedBox(
          height: 600,
          child: QuestionSwipeCard(
            question: question,
            questionNumber: questionNumber,
            totalQuestions: totalQuestions,
            selectedAnswer: selectedAnswer,
            onAnswerChanged: onAnswerChanged ?? (_) {},
          ),
        ),
      ),
    );
  }

  final mcqQuestion = QuizQuestionOut.fromJson({
    'id': 'qn1',
    'quizId': 'q1',
    'questionType': 'mcq',
    'questionText': 'What is 2+2?',
    'options': {'a': 'Three', 'b': 'Four', 'c': 'Five', 'd': 'Six'},
    'points': 2,
    'sequenceOrder': 1,
  });

  final trueFalseQuestion = QuizQuestionOut.fromJson({
    'id': 'qn2',
    'quizId': 'q1',
    'questionType': 'true_false',
    'questionText': 'The sky is blue.',
    'points': 1,
    'sequenceOrder': 2,
  });

  final shortAnswerQuestion = QuizQuestionOut.fromJson({
    'id': 'qn3',
    'quizId': 'q1',
    'questionType': 'short_answer',
    'questionText': 'Explain polymorphism.',
    'points': 5,
    'sequenceOrder': 3,
  });

  group('QuestionSwipeCard', () {
    testWidgets('renders question number badge', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        question: mcqQuestion,
        questionNumber: 1,
        totalQuestions: 5,
      ));
      expect(find.text('Q1'), findsOneWidget);
    });

    testWidgets('renders question text', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        question: mcqQuestion,
        questionNumber: 1,
        totalQuestions: 5,
      ));
      expect(find.text('What is 2+2?'), findsOneWidget);
    });

    testWidgets('renders MCQ options', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        question: mcqQuestion,
        questionNumber: 1,
        totalQuestions: 5,
      ));
      expect(find.text('Three'), findsOneWidget);
      expect(find.text('Four'), findsOneWidget);
      expect(find.text('Five'), findsOneWidget);
      expect(find.text('Six'), findsOneWidget);
    });

    testWidgets('MCQ calls onAnswerChanged with option key', (tester) async {
      String? answer;
      await tester.pumpWidget(buildTestWidget(
        question: mcqQuestion,
        questionNumber: 1,
        totalQuestions: 5,
        onAnswerChanged: (v) => answer = v,
      ));
      await tester.tap(find.text('Four'));
      expect(answer, 'b');
    });

    testWidgets('renders true/false buttons', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        question: trueFalseQuestion,
        questionNumber: 2,
        totalQuestions: 5,
      ));
      expect(find.text('True'), findsOneWidget);
      expect(find.text('False'), findsOneWidget);
    });

    testWidgets('true/false calls onAnswerChanged', (tester) async {
      String? answer;
      await tester.pumpWidget(buildTestWidget(
        question: trueFalseQuestion,
        questionNumber: 2,
        totalQuestions: 5,
        onAnswerChanged: (v) => answer = v,
      ));
      await tester.tap(find.text('True'));
      expect(answer, 'true');
    });

    testWidgets('renders short answer TextField', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        question: shortAnswerQuestion,
        questionNumber: 3,
        totalQuestions: 5,
      ));
      expect(find.byType(TextField), findsOneWidget);
    });

    testWidgets('renders points badge', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        question: mcqQuestion,
        questionNumber: 1,
        totalQuestions: 5,
      ));
      expect(find.textContaining('2'), findsWidgets);
    });
  });
}

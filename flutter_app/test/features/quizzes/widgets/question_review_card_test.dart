import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ict_lms_student/features/quizzes/widgets/question_review_card.dart';
import 'package:ict_lms_student/models/quiz_question_out.dart';
import 'package:ict_lms_student/models/quiz_attempt_out.dart';

void main() {
  Widget buildTestWidget({
    required QuizQuestionOut question,
    required QuizAnswerOut answer,
    required int questionNumber,
  }) {
    return MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: QuestionReviewCard(
            question: question,
            answer: answer,
            questionNumber: questionNumber,
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

  group('QuestionReviewCard', () {
    testWidgets('renders question text', (tester) async {
      final answer = QuizAnswerOut.fromJson({
        'id': 'ans1',
        'questionId': 'qn1',
        'answerText': 'b',
        'isCorrect': true,
        'pointsAwarded': 2,
      });
      await tester.pumpWidget(buildTestWidget(
        question: mcqQuestion,
        answer: answer,
        questionNumber: 1,
      ));
      expect(find.text('What is 2+2?'), findsOneWidget);
    });

    testWidgets('renders student answer', (tester) async {
      final answer = QuizAnswerOut.fromJson({
        'id': 'ans1',
        'questionId': 'qn1',
        'answerText': 'b',
        'isCorrect': true,
        'pointsAwarded': 2,
      });
      await tester.pumpWidget(buildTestWidget(
        question: mcqQuestion,
        answer: answer,
        questionNumber: 1,
      ));
      expect(find.textContaining('Four'), findsWidgets);
    });

    testWidgets('shows correct icon for correct answer', (tester) async {
      final answer = QuizAnswerOut.fromJson({
        'id': 'ans1',
        'questionId': 'qn1',
        'answerText': 'b',
        'isCorrect': true,
        'pointsAwarded': 2,
      });
      await tester.pumpWidget(buildTestWidget(
        question: mcqQuestion,
        answer: answer,
        questionNumber: 1,
      ));
      expect(find.byIcon(Icons.check_circle), findsOneWidget);
    });

    testWidgets('shows incorrect icon for wrong answer', (tester) async {
      final answer = QuizAnswerOut.fromJson({
        'id': 'ans1',
        'questionId': 'qn1',
        'answerText': 'a',
        'isCorrect': false,
        'pointsAwarded': 0,
      });
      await tester.pumpWidget(buildTestWidget(
        question: mcqQuestion,
        answer: answer,
        questionNumber: 1,
      ));
      expect(find.byIcon(Icons.cancel), findsOneWidget);
    });

    testWidgets('shows pending icon when isCorrect is null', (tester) async {
      final answer = QuizAnswerOut.fromJson({
        'id': 'ans1',
        'questionId': 'qn1',
        'answerText': 'Some answer',
      });
      await tester.pumpWidget(buildTestWidget(
        question: mcqQuestion,
        answer: answer,
        questionNumber: 1,
      ));
      expect(find.byIcon(Icons.hourglass_empty), findsOneWidget);
    });

    testWidgets('renders feedback when present', (tester) async {
      final answer = QuizAnswerOut.fromJson({
        'id': 'ans1',
        'questionId': 'qn1',
        'answerText': 'b',
        'isCorrect': true,
        'pointsAwarded': 2,
        'feedback': 'Well done!',
      });
      await tester.pumpWidget(buildTestWidget(
        question: mcqQuestion,
        answer: answer,
        questionNumber: 1,
      ));
      expect(find.text('Well done!'), findsOneWidget);
    });

    testWidgets('renders points', (tester) async {
      final answer = QuizAnswerOut.fromJson({
        'id': 'ans1',
        'questionId': 'qn1',
        'answerText': 'b',
        'isCorrect': true,
        'pointsAwarded': 2,
      });
      await tester.pumpWidget(buildTestWidget(
        question: mcqQuestion,
        answer: answer,
        questionNumber: 1,
      ));
      expect(find.textContaining('2'), findsWidgets);
    });
  });
}

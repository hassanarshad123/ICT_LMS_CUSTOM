import 'package:flutter_test/flutter_test.dart';
import 'package:ict_lms_student/models/quiz_question_out.dart';

void main() {
  group('QuizQuestionOut', () {
    final mcqJson = <String, dynamic>{
      'id': 'q-001',
      'quizId': 'quiz-001',
      'questionType': 'mcq',
      'questionText': 'What is 2+2?',
      'options': {'a': '3', 'b': '4', 'c': '5', 'd': '6'},
      'points': 2,
      'sequenceOrder': 1,
      'createdAt': '2026-03-01T10:00:00.000Z',
    };

    final trueFalseJson = <String, dynamic>{
      'id': 'q-002',
      'quizId': 'quiz-001',
      'questionType': 'true_false',
      'questionText': 'The sky is blue.',
      'options': null,
      'points': 1,
      'sequenceOrder': 2,
    };

    final shortAnswerJson = <String, dynamic>{
      'id': 'q-003',
      'quizId': 'quiz-001',
      'questionType': 'short_answer',
      'questionText': 'Explain polymorphism.',
      'points': 5,
      'sequenceOrder': 3,
    };

    test('fromJson parses MCQ with options map', () {
      final q = QuizQuestionOut.fromJson(mcqJson);
      expect(q.id, 'q-001');
      expect(q.quizId, 'quiz-001');
      expect(q.questionType, 'mcq');
      expect(q.questionText, 'What is 2+2?');
      expect(q.options, isA<Map<String, dynamic>>());
      expect(q.options!['b'], '4');
      expect(q.points, 2);
      expect(q.sequenceOrder, 1);
      expect(q.createdAt, isA<DateTime>());
    });

    test('fromJson parses true_false with null options', () {
      final q = QuizQuestionOut.fromJson(trueFalseJson);
      expect(q.questionType, 'true_false');
      expect(q.options, isNull);
      expect(q.points, 1);
    });

    test('fromJson parses short_answer with missing options', () {
      final q = QuizQuestionOut.fromJson(shortAnswerJson);
      expect(q.questionType, 'short_answer');
      expect(q.options, isNull);
      expect(q.points, 5);
      expect(q.createdAt, isNull);
    });

    test('fromJson handles missing keys gracefully', () {
      final json = <String, dynamic>{'id': 'q-999'};
      final q = QuizQuestionOut.fromJson(json);
      expect(q.id, 'q-999');
      expect(q.quizId, '');
      expect(q.questionType, '');
      expect(q.questionText, '');
      expect(q.options, isNull);
      expect(q.points, 0);
      expect(q.sequenceOrder, 0);
    });

    test('toJson round-trip preserves data for MCQ', () {
      final q = QuizQuestionOut.fromJson(mcqJson);
      final roundTripped = QuizQuestionOut.fromJson(q.toJson());
      expect(roundTripped, equals(q));
      expect(roundTripped.questionText, q.questionText);
      expect(roundTripped.options, q.options);
    });

    test('toJson round-trip for short_answer', () {
      final q = QuizQuestionOut.fromJson(shortAnswerJson);
      final json = q.toJson();
      expect(json['options'], isNull);
      final roundTripped = QuizQuestionOut.fromJson(json);
      expect(roundTripped.questionType, 'short_answer');
    });

    test('copyWith changes single field', () {
      final q = QuizQuestionOut.fromJson(mcqJson);
      final changed = q.copyWith(questionText: 'Updated?');
      expect(changed.questionText, 'Updated?');
      expect(changed.id, q.id);
      expect(changed.options, q.options);
    });

    test('copyWith no-change returns equal', () {
      final q = QuizQuestionOut.fromJson(mcqJson);
      final copy = q.copyWith();
      expect(copy, equals(q));
    });

    test('equality by id', () {
      final q1 = QuizQuestionOut.fromJson(mcqJson);
      final q2 = QuizQuestionOut.fromJson({...mcqJson, 'questionText': 'Diff'});
      expect(q1, equals(q2));
    });

    test('inequality with different id', () {
      final q1 = QuizQuestionOut.fromJson(mcqJson);
      final q2 = QuizQuestionOut.fromJson({...mcqJson, 'id': 'q-999'});
      expect(q1, isNot(equals(q2)));
    });

    test('hashCode based on id', () {
      final q1 = QuizQuestionOut.fromJson(mcqJson);
      final q2 = QuizQuestionOut.fromJson({...mcqJson, 'questionText': 'X'});
      expect(q1.hashCode, equals(q2.hashCode));
    });
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:ict_lms_student/models/quiz_attempt_out.dart';

void main() {
  group('QuizAttemptOut', () {
    final gradedJson = <String, dynamic>{
      'id': 'att-001',
      'quizId': 'quiz-001',
      'studentId': 'student-001',
      'status': 'graded',
      'score': 8,
      'maxScore': 10,
      'percentage': 80,
      'passed': true,
      'startedAt': '2026-03-01T10:00:00.000Z',
      'submittedAt': '2026-03-01T10:25:00.000Z',
      'gradedAt': '2026-03-01T11:00:00.000Z',
    };

    final inProgressJson = <String, dynamic>{
      'id': 'att-002',
      'quizId': 'quiz-001',
      'studentId': 'student-001',
      'status': 'in_progress',
      'startedAt': '2026-03-01T10:00:00.000Z',
    };

    final submittedJson = <String, dynamic>{
      'id': 'att-003',
      'quizId': 'quiz-001',
      'studentId': 'student-001',
      'status': 'submitted',
      'score': 5,
      'maxScore': 10,
      'percentage': 50,
      'passed': false,
      'startedAt': '2026-03-01T10:00:00.000Z',
      'submittedAt': '2026-03-01T10:30:00.000Z',
    };

    test('fromJson parses graded attempt', () {
      final attempt = QuizAttemptOut.fromJson(gradedJson);
      expect(attempt.id, 'att-001');
      expect(attempt.quizId, 'quiz-001');
      expect(attempt.studentId, 'student-001');
      expect(attempt.status, 'graded');
      expect(attempt.score, 8);
      expect(attempt.maxScore, 10);
      expect(attempt.percentage, 80);
      expect(attempt.passed, true);
      expect(attempt.startedAt, isA<DateTime>());
      expect(attempt.submittedAt, isA<DateTime>());
      expect(attempt.gradedAt, isA<DateTime>());
    });

    test('fromJson parses in_progress attempt with nulls', () {
      final attempt = QuizAttemptOut.fromJson(inProgressJson);
      expect(attempt.status, 'in_progress');
      expect(attempt.score, isNull);
      expect(attempt.maxScore, isNull);
      expect(attempt.percentage, isNull);
      expect(attempt.passed, isNull);
      expect(attempt.submittedAt, isNull);
      expect(attempt.gradedAt, isNull);
    });

    test('fromJson parses submitted attempt', () {
      final attempt = QuizAttemptOut.fromJson(submittedJson);
      expect(attempt.status, 'submitted');
      expect(attempt.passed, false);
      expect(attempt.gradedAt, isNull);
    });

    test('fromJson handles missing keys', () {
      final json = <String, dynamic>{'id': 'att-999'};
      final attempt = QuizAttemptOut.fromJson(json);
      expect(attempt.id, 'att-999');
      expect(attempt.quizId, '');
      expect(attempt.studentId, '');
      expect(attempt.status, '');
    });

    test('toJson round-trip preserves data', () {
      final attempt = QuizAttemptOut.fromJson(gradedJson);
      final roundTripped = QuizAttemptOut.fromJson(attempt.toJson());
      expect(roundTripped, equals(attempt));
      expect(roundTripped.score, attempt.score);
      expect(roundTripped.passed, attempt.passed);
    });

    test('copyWith changes single field', () {
      final attempt = QuizAttemptOut.fromJson(gradedJson);
      final changed = attempt.copyWith(status: 'submitted');
      expect(changed.status, 'submitted');
      expect(changed.id, attempt.id);
      expect(changed.score, attempt.score);
    });

    test('equality by id', () {
      final a1 = QuizAttemptOut.fromJson(gradedJson);
      final a2 = QuizAttemptOut.fromJson({...gradedJson, 'status': 'submitted'});
      expect(a1, equals(a2));
    });

    test('hashCode based on id', () {
      final a1 = QuizAttemptOut.fromJson(gradedJson);
      final a2 = QuizAttemptOut.fromJson({...gradedJson, 'score': 99});
      expect(a1.hashCode, equals(a2.hashCode));
    });
  });

  group('QuizAnswerOut', () {
    test('fromJson parses correct answer', () {
      final json = <String, dynamic>{
        'id': 'ans-001',
        'questionId': 'q-001',
        'answerText': 'b',
        'isCorrect': true,
        'pointsAwarded': 2,
        'feedback': 'Well done!',
      };
      final answer = QuizAnswerOut.fromJson(json);
      expect(answer.id, 'ans-001');
      expect(answer.questionId, 'q-001');
      expect(answer.answerText, 'b');
      expect(answer.isCorrect, true);
      expect(answer.pointsAwarded, 2);
      expect(answer.feedback, 'Well done!');
    });

    test('fromJson parses incorrect answer', () {
      final json = <String, dynamic>{
        'id': 'ans-002',
        'questionId': 'q-002',
        'answerText': 'false',
        'isCorrect': false,
        'pointsAwarded': 0,
      };
      final answer = QuizAnswerOut.fromJson(json);
      expect(answer.isCorrect, false);
      expect(answer.pointsAwarded, 0);
      expect(answer.feedback, isNull);
    });

    test('fromJson parses ungraded answer (isCorrect null)', () {
      final json = <String, dynamic>{
        'id': 'ans-003',
        'questionId': 'q-003',
        'answerText': 'Polymorphism is...',
      };
      final answer = QuizAnswerOut.fromJson(json);
      expect(answer.isCorrect, isNull);
      expect(answer.pointsAwarded, isNull);
      expect(answer.feedback, isNull);
    });

    test('toJson round-trip preserves data', () {
      final json = <String, dynamic>{
        'id': 'ans-001',
        'questionId': 'q-001',
        'answerText': 'b',
        'isCorrect': true,
        'pointsAwarded': 2,
        'feedback': 'Good',
      };
      final answer = QuizAnswerOut.fromJson(json);
      final roundTripped = QuizAnswerOut.fromJson(answer.toJson());
      expect(roundTripped, equals(answer));
    });

    test('equality by id', () {
      final a1 = QuizAnswerOut.fromJson({'id': 'ans-001', 'questionId': 'q-001'});
      final a2 = QuizAnswerOut.fromJson({'id': 'ans-001', 'questionId': 'q-002'});
      expect(a1, equals(a2));
    });
  });

  group('QuizAttemptDetailOut', () {
    test('fromJson with nested answers list', () {
      final json = <String, dynamic>{
        'id': 'att-001',
        'quizId': 'quiz-001',
        'studentId': 'student-001',
        'status': 'graded',
        'score': 8,
        'maxScore': 10,
        'percentage': 80,
        'passed': true,
        'startedAt': '2026-03-01T10:00:00.000Z',
        'submittedAt': '2026-03-01T10:25:00.000Z',
        'gradedAt': '2026-03-01T11:00:00.000Z',
        'answers': [
          {
            'id': 'ans-001',
            'questionId': 'q-001',
            'answerText': 'b',
            'isCorrect': true,
            'pointsAwarded': 2,
          },
          {
            'id': 'ans-002',
            'questionId': 'q-002',
            'answerText': 'true',
            'isCorrect': false,
            'pointsAwarded': 0,
          },
        ],
      };

      final detail = QuizAttemptDetailOut.fromJson(json);
      expect(detail.id, 'att-001');
      expect(detail.status, 'graded');
      expect(detail.score, 8);
      expect(detail.answers, hasLength(2));
      expect(detail.answers[0].isCorrect, true);
      expect(detail.answers[1].isCorrect, false);
    });

    test('fromJson with empty answers list', () {
      final json = <String, dynamic>{
        'id': 'att-002',
        'quizId': 'quiz-001',
        'studentId': 'student-001',
        'status': 'in_progress',
        'answers': [],
      };
      final detail = QuizAttemptDetailOut.fromJson(json);
      expect(detail.answers, isEmpty);
    });

    test('fromJson with missing answers key', () {
      final json = <String, dynamic>{
        'id': 'att-003',
        'quizId': 'quiz-001',
        'studentId': 'student-001',
        'status': 'in_progress',
      };
      final detail = QuizAttemptDetailOut.fromJson(json);
      expect(detail.answers, isEmpty);
    });

    test('toJson round-trip preserves answers', () {
      final json = <String, dynamic>{
        'id': 'att-001',
        'quizId': 'quiz-001',
        'studentId': 'student-001',
        'status': 'graded',
        'answers': [
          {'id': 'ans-001', 'questionId': 'q-001', 'answerText': 'b', 'isCorrect': true, 'pointsAwarded': 2},
        ],
      };
      final detail = QuizAttemptDetailOut.fromJson(json);
      final roundTripped = QuizAttemptDetailOut.fromJson(detail.toJson());
      expect(roundTripped.answers, hasLength(1));
      expect(roundTripped.answers[0].answerText, 'b');
    });

    test('equality by id (inherits from QuizAttemptOut)', () {
      final d1 = QuizAttemptDetailOut.fromJson({'id': 'att-001', 'quizId': 'q1', 'studentId': 's1', 'status': 'graded', 'answers': []});
      final d2 = QuizAttemptDetailOut.fromJson({'id': 'att-001', 'quizId': 'q1', 'studentId': 's1', 'status': 'submitted', 'answers': []});
      expect(d1, equals(d2));
    });
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:ict_lms_student/models/quiz_out.dart';

void main() {
  group('QuizOut', () {
    final fullJson = <String, dynamic>{
      'id': 'quiz-001',
      'courseId': 'course-001',
      'moduleId': 'module-001',
      'title': 'Midterm Quiz',
      'description': 'Test your knowledge',
      'timeLimitMinutes': 30,
      'passPercentage': 70,
      'maxAttempts': 3,
      'isPublished': true,
      'sequenceOrder': 1,
      'questionCount': 10,
      'createdBy': 'user-001',
      'createdAt': '2026-03-01T10:00:00.000Z',
      'updatedAt': '2026-03-02T10:00:00.000Z',
    };

    test('fromJson parses all fields', () {
      final quiz = QuizOut.fromJson(fullJson);
      expect(quiz.id, 'quiz-001');
      expect(quiz.courseId, 'course-001');
      expect(quiz.moduleId, 'module-001');
      expect(quiz.title, 'Midterm Quiz');
      expect(quiz.description, 'Test your knowledge');
      expect(quiz.timeLimitMinutes, 30);
      expect(quiz.passPercentage, 70);
      expect(quiz.maxAttempts, 3);
      expect(quiz.isPublished, true);
      expect(quiz.sequenceOrder, 1);
      expect(quiz.questionCount, 10);
      expect(quiz.createdBy, 'user-001');
      expect(quiz.createdAt, isA<DateTime>());
      expect(quiz.updatedAt, isA<DateTime>());
    });

    test('fromJson handles nullable fields as null', () {
      final json = <String, dynamic>{
        'id': 'quiz-002',
        'courseId': 'course-001',
        'title': 'Short Quiz',
        'passPercentage': 50,
        'maxAttempts': 1,
        'isPublished': false,
        'sequenceOrder': 2,
        'questionCount': 5,
      };
      final quiz = QuizOut.fromJson(json);
      expect(quiz.moduleId, isNull);
      expect(quiz.description, isNull);
      expect(quiz.timeLimitMinutes, isNull);
      expect(quiz.createdBy, isNull);
      expect(quiz.createdAt, isNull);
      expect(quiz.updatedAt, isNull);
    });

    test('fromJson handles missing keys gracefully', () {
      final json = <String, dynamic>{'id': 'quiz-003'};
      final quiz = QuizOut.fromJson(json);
      expect(quiz.id, 'quiz-003');
      expect(quiz.courseId, '');
      expect(quiz.title, '');
      expect(quiz.passPercentage, 0);
      expect(quiz.maxAttempts, 0);
      expect(quiz.isPublished, false);
      expect(quiz.sequenceOrder, 0);
      expect(quiz.questionCount, 0);
    });

    test('toJson produces correct map', () {
      final quiz = QuizOut.fromJson(fullJson);
      final json = quiz.toJson();
      expect(json['id'], 'quiz-001');
      expect(json['courseId'], 'course-001');
      expect(json['moduleId'], 'module-001');
      expect(json['title'], 'Midterm Quiz');
      expect(json['timeLimitMinutes'], 30);
      expect(json['isPublished'], true);
    });

    test('toJson round-trip preserves data', () {
      final quiz = QuizOut.fromJson(fullJson);
      final roundTripped = QuizOut.fromJson(quiz.toJson());
      expect(roundTripped, equals(quiz));
      expect(roundTripped.title, quiz.title);
      expect(roundTripped.timeLimitMinutes, quiz.timeLimitMinutes);
    });

    test('copyWith changes single field', () {
      final quiz = QuizOut.fromJson(fullJson);
      final changed = quiz.copyWith(title: 'Final Quiz');
      expect(changed.title, 'Final Quiz');
      expect(changed.id, quiz.id);
      expect(changed.courseId, quiz.courseId);
    });

    test('copyWith no-change returns equal object', () {
      final quiz = QuizOut.fromJson(fullJson);
      final copy = quiz.copyWith();
      expect(copy, equals(quiz));
    });

    test('equality by id', () {
      final quiz1 = QuizOut.fromJson(fullJson);
      final quiz2 = QuizOut.fromJson({...fullJson, 'title': 'Different'});
      expect(quiz1, equals(quiz2));
    });

    test('inequality with different id', () {
      final quiz1 = QuizOut.fromJson(fullJson);
      final quiz2 = QuizOut.fromJson({...fullJson, 'id': 'quiz-999'});
      expect(quiz1, isNot(equals(quiz2)));
    });

    test('hashCode based on id', () {
      final quiz1 = QuizOut.fromJson(fullJson);
      final quiz2 = QuizOut.fromJson({...fullJson, 'title': 'Different'});
      expect(quiz1.hashCode, equals(quiz2.hashCode));
    });

    test('toString includes key fields', () {
      final quiz = QuizOut.fromJson(fullJson);
      final str = quiz.toString();
      expect(str, contains('quiz-001'));
      expect(str, contains('Midterm Quiz'));
    });
  });
}

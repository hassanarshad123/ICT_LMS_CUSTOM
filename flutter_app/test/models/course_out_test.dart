import 'package:flutter_test/flutter_test.dart';
import 'package:ict_lms_student/models/course_out.dart';

void main() {
  group('CourseOut', () {
    final fullJson = <String, dynamic>{
      'id': 'course-001',
      'title': 'Introduction to Flutter',
      'description': 'Learn Flutter from scratch',
      'status': 'active',
      'batchIds': ['batch-001', 'batch-002'],
      'clonedFromId': 'course-000',
      'createdBy': 'user-001',
      'createdAt': '2026-03-01T10:00:00.000Z',
    };

    group('fromJson', () {
      test('parses all fields correctly', () {
        final course = CourseOut.fromJson(fullJson);

        expect(course.id, 'course-001');
        expect(course.title, 'Introduction to Flutter');
        expect(course.description, 'Learn Flutter from scratch');
        expect(course.status, 'active');
        expect(course.batchIds, ['batch-001', 'batch-002']);
        expect(course.clonedFromId, 'course-000');
        expect(course.createdBy, 'user-001');
        expect(course.createdAt, isA<DateTime>());
        expect(course.createdAt!.year, 2026);
      });

      test('handles nullable fields as null', () {
        final json = <String, dynamic>{
          'id': 'course-002',
          'title': 'Minimal Course',
          'status': 'draft',
        };
        final course = CourseOut.fromJson(json);

        expect(course.description, isNull);
        expect(course.batchIds, isEmpty);
        expect(course.clonedFromId, isNull);
        expect(course.createdBy, isNull);
        expect(course.createdAt, isNull);
      });

      test('handles missing keys gracefully', () {
        final json = <String, dynamic>{'id': 'course-003'};
        final course = CourseOut.fromJson(json);

        expect(course.id, 'course-003');
        expect(course.title, '');
        expect(course.status, '');
        expect(course.batchIds, isEmpty);
      });

      test('handles empty map', () {
        final course = CourseOut.fromJson(<String, dynamic>{});
        expect(course.id, '');
        expect(course.title, '');
      });

      test('converts non-string id via toString', () {
        final json = <String, dynamic>{
          'id': 42,
          'title': 'Test',
          'status': 'active',
        };
        final course = CourseOut.fromJson(json);
        expect(course.id, '42');
      });

      test('handles invalid date string', () {
        final json = <String, dynamic>{
          'id': 'course-004',
          'createdAt': 'not-a-date',
        };
        final course = CourseOut.fromJson(json);
        expect(course.createdAt, isNull);
      });
    });

    group('toJson', () {
      test('produces correct map', () {
        final course = CourseOut.fromJson(fullJson);
        final json = course.toJson();

        expect(json['id'], 'course-001');
        expect(json['title'], 'Introduction to Flutter');
        expect(json['description'], 'Learn Flutter from scratch');
        expect(json['status'], 'active');
        expect(json['batchIds'], ['batch-001', 'batch-002']);
        expect(json['clonedFromId'], 'course-000');
        expect(json['createdBy'], 'user-001');
        expect(json['createdAt'], isA<String>());
      });

      test('round-trip preserves data', () {
        final course = CourseOut.fromJson(fullJson);
        final roundTripped = CourseOut.fromJson(course.toJson());

        expect(roundTripped, equals(course));
        expect(roundTripped.title, course.title);
        expect(roundTripped.description, course.description);
        expect(roundTripped.status, course.status);
        expect(roundTripped.batchIds, course.batchIds);
        expect(roundTripped.clonedFromId, course.clonedFromId);
        expect(roundTripped.createdBy, course.createdBy);
      });

      test('null createdAt serializes as null', () {
        final course = CourseOut.fromJson(<String, dynamic>{
          'id': 'course-005',
          'title': 'No Date',
          'status': 'draft',
        });
        final json = course.toJson();
        expect(json['createdAt'], isNull);
      });
    });

    group('copyWith', () {
      test('changes single field', () {
        final course = CourseOut.fromJson(fullJson);
        final changed = course.copyWith(title: 'Advanced Flutter');

        expect(changed.title, 'Advanced Flutter');
        expect(changed.id, course.id);
        expect(changed.status, course.status);
      });

      test('no-change returns equal object', () {
        final course = CourseOut.fromJson(fullJson);
        final copy = course.copyWith();
        expect(copy, equals(course));
      });

      test('changes status field', () {
        final course = CourseOut.fromJson(fullJson);
        final changed = course.copyWith(status: 'archived');
        expect(changed.status, 'archived');
        expect(course.status, 'active');
      });
    });

    group('equality', () {
      test('equal by id', () {
        final course1 = CourseOut.fromJson(fullJson);
        final course2 = CourseOut.fromJson({...fullJson, 'title': 'Different'});
        expect(course1, equals(course2));
      });

      test('not equal with different id', () {
        final course1 = CourseOut.fromJson(fullJson);
        final course2 =
            CourseOut.fromJson({...fullJson, 'id': 'course-999'});
        expect(course1, isNot(equals(course2)));
      });

      test('hashCode based on id', () {
        final course1 = CourseOut.fromJson(fullJson);
        final course2 = CourseOut.fromJson({...fullJson, 'title': 'Different'});
        expect(course1.hashCode, equals(course2.hashCode));
      });
    });

    test('toString includes key fields', () {
      final course = CourseOut.fromJson(fullJson);
      final str = course.toString();
      expect(str, contains('course-001'));
      expect(str, contains('Introduction to Flutter'));
      expect(str, contains('active'));
    });
  });
}

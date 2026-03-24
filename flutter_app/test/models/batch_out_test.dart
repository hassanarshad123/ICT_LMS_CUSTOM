import 'package:flutter_test/flutter_test.dart';
import 'package:ict_lms_student/models/batch_out.dart';

void main() {
  group('BatchOut', () {
    final fullJson = <String, dynamic>{
      'id': 'batch-001',
      'name': 'Spring 2026 Cohort',
      'startDate': '2026-03-01T00:00:00.000Z',
      'endDate': '2026-06-30T23:59:59.000Z',
      'teacherId': 'teacher-001',
      'teacherName': 'Dr. Smith',
      'studentCount': 25,
      'courseCount': 4,
      'status': 'active',
      'createdBy': 'admin-001',
      'createdAt': '2026-02-15T10:00:00.000Z',
    };

    group('fromJson', () {
      test('parses all fields correctly', () {
        final batch = BatchOut.fromJson(fullJson);

        expect(batch.id, 'batch-001');
        expect(batch.name, 'Spring 2026 Cohort');
        expect(batch.startDate, isA<DateTime>());
        expect(batch.startDate!.year, 2026);
        expect(batch.startDate!.month, 3);
        expect(batch.endDate, isA<DateTime>());
        expect(batch.endDate!.month, 6);
        expect(batch.teacherId, 'teacher-001');
        expect(batch.teacherName, 'Dr. Smith');
        expect(batch.studentCount, 25);
        expect(batch.courseCount, 4);
        expect(batch.status, 'active');
        expect(batch.createdBy, 'admin-001');
        expect(batch.createdAt, isA<DateTime>());
      });

      test('handles nullable fields as null', () {
        final json = <String, dynamic>{
          'id': 'batch-002',
          'name': 'Minimal Batch',
          'status': 'draft',
        };
        final batch = BatchOut.fromJson(json);

        expect(batch.startDate, isNull);
        expect(batch.endDate, isNull);
        expect(batch.teacherId, isNull);
        expect(batch.teacherName, isNull);
        expect(batch.studentCount, 0);
        expect(batch.courseCount, 0);
        expect(batch.createdBy, isNull);
        expect(batch.createdAt, isNull);
      });

      test('handles missing keys gracefully', () {
        final json = <String, dynamic>{'id': 'batch-003'};
        final batch = BatchOut.fromJson(json);

        expect(batch.id, 'batch-003');
        expect(batch.name, '');
        expect(batch.status, '');
        expect(batch.studentCount, 0);
        expect(batch.courseCount, 0);
      });

      test('handles empty map', () {
        final batch = BatchOut.fromJson(<String, dynamic>{});
        expect(batch.id, '');
        expect(batch.name, '');
      });

      test('handles invalid date strings', () {
        final json = <String, dynamic>{
          'id': 'batch-004',
          'startDate': 'bad-date',
          'endDate': '',
          'createdAt': 'nope',
        };
        final batch = BatchOut.fromJson(json);
        expect(batch.startDate, isNull);
        expect(batch.endDate, isNull);
        expect(batch.createdAt, isNull);
      });

      test('converts non-string id via toString', () {
        final json = <String, dynamic>{
          'id': 999,
          'name': 'Test',
          'status': 'active',
        };
        final batch = BatchOut.fromJson(json);
        expect(batch.id, '999');
      });
    });

    group('toJson', () {
      test('produces correct map', () {
        final batch = BatchOut.fromJson(fullJson);
        final json = batch.toJson();

        expect(json['id'], 'batch-001');
        expect(json['name'], 'Spring 2026 Cohort');
        expect(json['startDate'], isA<String>());
        expect(json['endDate'], isA<String>());
        expect(json['teacherId'], 'teacher-001');
        expect(json['teacherName'], 'Dr. Smith');
        expect(json['studentCount'], 25);
        expect(json['courseCount'], 4);
        expect(json['status'], 'active');
      });

      test('round-trip preserves data', () {
        final batch = BatchOut.fromJson(fullJson);
        final roundTripped = BatchOut.fromJson(batch.toJson());

        expect(roundTripped, equals(batch));
        expect(roundTripped.name, batch.name);
        expect(roundTripped.studentCount, batch.studentCount);
        expect(roundTripped.courseCount, batch.courseCount);
        expect(roundTripped.teacherName, batch.teacherName);
        expect(roundTripped.status, batch.status);
      });

      test('null dates serialize as null', () {
        final batch = BatchOut.fromJson(<String, dynamic>{
          'id': 'batch-005',
          'name': 'No Dates',
          'status': 'draft',
        });
        final json = batch.toJson();
        expect(json['startDate'], isNull);
        expect(json['endDate'], isNull);
        expect(json['createdAt'], isNull);
      });
    });

    group('copyWith', () {
      test('changes single field', () {
        final batch = BatchOut.fromJson(fullJson);
        final changed = batch.copyWith(name: 'Fall 2026 Cohort');

        expect(changed.name, 'Fall 2026 Cohort');
        expect(changed.id, batch.id);
        expect(changed.status, batch.status);
      });

      test('changes student count', () {
        final batch = BatchOut.fromJson(fullJson);
        final changed = batch.copyWith(studentCount: 50);

        expect(changed.studentCount, 50);
        expect(batch.studentCount, 25); // original unchanged
      });

      test('no-change returns equal object', () {
        final batch = BatchOut.fromJson(fullJson);
        final copy = batch.copyWith();
        expect(copy, equals(batch));
      });
    });

    group('equality', () {
      test('equal by id', () {
        final batch1 = BatchOut.fromJson(fullJson);
        final batch2 = BatchOut.fromJson({...fullJson, 'name': 'Different'});
        expect(batch1, equals(batch2));
      });

      test('not equal with different id', () {
        final batch1 = BatchOut.fromJson(fullJson);
        final batch2 = BatchOut.fromJson({...fullJson, 'id': 'batch-999'});
        expect(batch1, isNot(equals(batch2)));
      });

      test('hashCode based on id', () {
        final batch1 = BatchOut.fromJson(fullJson);
        final batch2 = BatchOut.fromJson({...fullJson, 'name': 'Different'});
        expect(batch1.hashCode, equals(batch2.hashCode));
      });
    });

    test('toString includes key fields', () {
      final batch = BatchOut.fromJson(fullJson);
      final str = batch.toString();
      expect(str, contains('batch-001'));
      expect(str, contains('Spring 2026 Cohort'));
      expect(str, contains('active'));
    });
  });
}

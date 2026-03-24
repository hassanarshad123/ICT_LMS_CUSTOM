import 'package:flutter_test/flutter_test.dart';
import 'package:ict_lms_student/models/lecture_out.dart';

void main() {
  group('LectureOut', () {
    final fullJson = <String, dynamic>{
      'id': 'lec-001',
      'title': 'Introduction to Dart',
      'description': 'Learn Dart basics',
      'videoType': 'bunny',
      'videoUrl': 'https://video.bunnycdn.com/play/123',
      'bunnyVideoId': 'vid-abc-123',
      'videoStatus': 'ready',
      'duration': 3600,
      'durationDisplay': '1h 0m',
      'fileSize': 524288000,
      'batchId': 'batch-001',
      'courseId': 'course-001',
      'sequenceOrder': 1,
      'thumbnailUrl': 'https://cdn.example.com/thumb.jpg',
      'uploadDate': '2026-03-01T10:00:00.000Z',
      'createdAt': '2026-03-01T09:00:00.000Z',
      'isLocked': false,
    };

    group('fromJson', () {
      test('parses all fields correctly', () {
        final lecture = LectureOut.fromJson(fullJson);

        expect(lecture.id, 'lec-001');
        expect(lecture.title, 'Introduction to Dart');
        expect(lecture.description, 'Learn Dart basics');
        expect(lecture.videoType, 'bunny');
        expect(lecture.videoUrl, 'https://video.bunnycdn.com/play/123');
        expect(lecture.bunnyVideoId, 'vid-abc-123');
        expect(lecture.videoStatus, 'ready');
        expect(lecture.duration, 3600);
        expect(lecture.durationDisplay, '1h 0m');
        expect(lecture.fileSize, 524288000);
        expect(lecture.batchId, 'batch-001');
        expect(lecture.courseId, 'course-001');
        expect(lecture.sequenceOrder, 1);
        expect(lecture.thumbnailUrl, 'https://cdn.example.com/thumb.jpg');
        expect(lecture.uploadDate, isA<DateTime>());
        expect(lecture.createdAt, isA<DateTime>());
        expect(lecture.isLocked, false);
      });

      test('handles nullable fields as null', () {
        final json = <String, dynamic>{
          'id': 'lec-002',
          'title': 'Minimal Lecture',
          'videoType': 'external',
          'batchId': 'batch-001',
        };
        final lecture = LectureOut.fromJson(json);

        expect(lecture.description, isNull);
        expect(lecture.videoUrl, isNull);
        expect(lecture.bunnyVideoId, isNull);
        expect(lecture.videoStatus, isNull);
        expect(lecture.duration, isNull);
        expect(lecture.durationDisplay, isNull);
        expect(lecture.fileSize, isNull);
        expect(lecture.courseId, isNull);
        expect(lecture.thumbnailUrl, isNull);
        expect(lecture.uploadDate, isNull);
        expect(lecture.createdAt, isNull);
      });

      test('handles missing keys with defaults', () {
        final json = <String, dynamic>{'id': 'lec-003'};
        final lecture = LectureOut.fromJson(json);

        expect(lecture.id, 'lec-003');
        expect(lecture.title, '');
        expect(lecture.videoType, 'external');
        expect(lecture.batchId, '');
        expect(lecture.sequenceOrder, 0);
        expect(lecture.isLocked, false);
      });

      test('isLocked defaults to false', () {
        final json = <String, dynamic>{
          'id': 'lec-004',
          'title': 'Test',
          'videoType': 'external',
          'batchId': 'batch-001',
        };
        final lecture = LectureOut.fromJson(json);
        expect(lecture.isLocked, false);
      });

      test('isLocked can be set to true', () {
        final json = <String, dynamic>{
          'id': 'lec-005',
          'title': 'Locked Lecture',
          'videoType': 'bunny',
          'batchId': 'batch-001',
          'isLocked': true,
        };
        final lecture = LectureOut.fromJson(json);
        expect(lecture.isLocked, true);
      });

      test('handles invalid date string', () {
        final json = <String, dynamic>{
          'id': 'lec-006',
          'uploadDate': 'not-a-date',
          'createdAt': 'also-not-a-date',
        };
        final lecture = LectureOut.fromJson(json);
        expect(lecture.uploadDate, isNull);
        expect(lecture.createdAt, isNull);
      });
    });

    group('toJson', () {
      test('produces correct map', () {
        final lecture = LectureOut.fromJson(fullJson);
        final json = lecture.toJson();

        expect(json['id'], 'lec-001');
        expect(json['title'], 'Introduction to Dart');
        expect(json['videoType'], 'bunny');
        expect(json['isLocked'], false);
        expect(json['sequenceOrder'], 1);
        expect(json['batchId'], 'batch-001');
      });

      test('round-trip preserves data', () {
        final lecture = LectureOut.fromJson(fullJson);
        final roundTripped = LectureOut.fromJson(lecture.toJson());

        expect(roundTripped, equals(lecture));
        expect(roundTripped.title, lecture.title);
        expect(roundTripped.videoType, lecture.videoType);
        expect(roundTripped.isLocked, lecture.isLocked);
        expect(roundTripped.duration, lecture.duration);
        expect(roundTripped.sequenceOrder, lecture.sequenceOrder);
      });
    });

    group('copyWith', () {
      test('changes single field', () {
        final lecture = LectureOut.fromJson(fullJson);
        final changed = lecture.copyWith(title: 'Advanced Dart');

        expect(changed.title, 'Advanced Dart');
        expect(changed.id, lecture.id);
        expect(changed.videoType, lecture.videoType);
      });

      test('changes isLocked field', () {
        final lecture = LectureOut.fromJson(fullJson);
        expect(lecture.isLocked, false);

        final locked = lecture.copyWith(isLocked: true);
        expect(locked.isLocked, true);
        expect(lecture.isLocked, false); // original unchanged
      });

      test('no-change returns equal object', () {
        final lecture = LectureOut.fromJson(fullJson);
        final copy = lecture.copyWith();
        expect(copy, equals(lecture));
      });
    });

    group('isPlayable', () {
      test('returns true when videoStatus is ready', () {
        final lecture = LectureOut.fromJson({
          ...fullJson,
          'videoStatus': 'ready',
        });
        expect(lecture.isPlayable, true);
      });

      test('returns true for external video with URL', () {
        final lecture = LectureOut.fromJson({
          'id': 'lec-ext',
          'title': 'External',
          'videoType': 'external',
          'videoUrl': 'https://youtube.com/watch?v=123',
          'batchId': 'batch-001',
        });
        expect(lecture.isPlayable, true);
      });

      test('returns false for external video without URL', () {
        final lecture = LectureOut.fromJson({
          'id': 'lec-ext-no-url',
          'title': 'External No URL',
          'videoType': 'external',
          'batchId': 'batch-001',
        });
        expect(lecture.isPlayable, false);
      });

      test('returns false for external video with empty URL', () {
        final lecture = LectureOut.fromJson({
          'id': 'lec-ext-empty',
          'title': 'External Empty URL',
          'videoType': 'external',
          'videoUrl': '',
          'batchId': 'batch-001',
        });
        expect(lecture.isPlayable, false);
      });

      test('returns false for bunny video still processing', () {
        final lecture = LectureOut.fromJson({
          ...fullJson,
          'videoStatus': 'processing',
        });
        expect(lecture.isPlayable, false);
      });

      test('returns false for pending video', () {
        final lecture = LectureOut.fromJson({
          ...fullJson,
          'videoStatus': 'pending',
        });
        expect(lecture.isPlayable, false);
      });
    });

    group('equality', () {
      test('equal by id', () {
        final lec1 = LectureOut.fromJson(fullJson);
        final lec2 = LectureOut.fromJson({...fullJson, 'title': 'Different'});
        expect(lec1, equals(lec2));
      });

      test('not equal with different id', () {
        final lec1 = LectureOut.fromJson(fullJson);
        final lec2 = LectureOut.fromJson({...fullJson, 'id': 'lec-999'});
        expect(lec1, isNot(equals(lec2)));
      });

      test('hashCode based on id', () {
        final lec1 = LectureOut.fromJson(fullJson);
        final lec2 = LectureOut.fromJson({...fullJson, 'title': 'Different'});
        expect(lec1.hashCode, equals(lec2.hashCode));
      });
    });

    test('toString includes key fields', () {
      final lecture = LectureOut.fromJson(fullJson);
      final str = lecture.toString();
      expect(str, contains('lec-001'));
      expect(str, contains('Introduction to Dart'));
      expect(str, contains('bunny'));
    });
  });
}

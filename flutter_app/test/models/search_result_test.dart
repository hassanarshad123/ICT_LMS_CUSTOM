import 'package:flutter_test/flutter_test.dart';
import 'package:ict_lms_student/models/search_result.dart';

void main() {
  group('SearchResult', () {
    final fullJson = <String, dynamic>{
      'batches': [
        {'id': 'batch-001', 'name': 'Spring 2026'},
        {'id': 'batch-002', 'name': 'Fall 2026'},
      ],
      'courses': [
        {'id': 'course-001', 'title': 'Flutter Basics'},
      ],
      'announcements': [
        {'id': 'ann-001', 'title': 'Welcome!'},
        {'id': 'ann-002', 'title': 'Exam Schedule'},
      ],
    };

    group('fromJson', () {
      test('parses all categories correctly', () {
        final result = SearchResult.fromJson(fullJson);

        expect(result.batches, hasLength(2));
        expect(result.courses, hasLength(1));
        expect(result.announcements, hasLength(2));
      });

      test('assigns correct types to items', () {
        final result = SearchResult.fromJson(fullJson);

        expect(result.batches.first.type, 'batch');
        expect(result.courses.first.type, 'course');
        expect(result.announcements.first.type, 'announcement');
      });

      test('parses batch items with name field', () {
        final result = SearchResult.fromJson(fullJson);

        expect(result.batches.first.id, 'batch-001');
        expect(result.batches.first.title, 'Spring 2026');
        expect(result.batches.last.id, 'batch-002');
        expect(result.batches.last.title, 'Fall 2026');
      });

      test('parses course items with title field', () {
        final result = SearchResult.fromJson(fullJson);

        expect(result.courses.first.id, 'course-001');
        expect(result.courses.first.title, 'Flutter Basics');
      });

      test('handles missing categories', () {
        final result = SearchResult.fromJson(<String, dynamic>{});

        expect(result.batches, isEmpty);
        expect(result.courses, isEmpty);
        expect(result.announcements, isEmpty);
      });

      test('handles null categories', () {
        final json = <String, dynamic>{
          'batches': null,
          'courses': null,
          'announcements': null,
        };
        final result = SearchResult.fromJson(json);

        expect(result.batches, isEmpty);
        expect(result.courses, isEmpty);
        expect(result.announcements, isEmpty);
      });

      test('handles empty arrays', () {
        final json = <String, dynamic>{
          'batches': [],
          'courses': [],
          'announcements': [],
        };
        final result = SearchResult.fromJson(json);

        expect(result.batches, isEmpty);
        expect(result.courses, isEmpty);
        expect(result.announcements, isEmpty);
      });
    });

    group('isEmpty', () {
      test('returns true when all categories are empty', () {
        const result = SearchResult();
        expect(result.isEmpty, true);
      });

      test('returns false when batches has items', () {
        final result = SearchResult(
          batches: [
            const SearchItem(id: 'b1', title: 'Batch', type: 'batch'),
          ],
        );
        expect(result.isEmpty, false);
      });

      test('returns false when courses has items', () {
        final result = SearchResult(
          courses: [
            const SearchItem(id: 'c1', title: 'Course', type: 'course'),
          ],
        );
        expect(result.isEmpty, false);
      });

      test('returns false when announcements has items', () {
        final result = SearchResult(
          announcements: [
            const SearchItem(
                id: 'a1', title: 'Announcement', type: 'announcement'),
          ],
        );
        expect(result.isEmpty, false);
      });

      test('returns false for full result', () {
        final result = SearchResult.fromJson(fullJson);
        expect(result.isEmpty, false);
      });
    });
  });

  group('SearchItem', () {
    group('fromJson', () {
      test('uses name field as title for batches', () {
        final item = SearchItem.fromJson(
          {'id': 'batch-001', 'name': 'Spring 2026'},
          'batch',
        );
        expect(item.id, 'batch-001');
        expect(item.title, 'Spring 2026');
        expect(item.type, 'batch');
      });

      test('uses title field as title for courses', () {
        final item = SearchItem.fromJson(
          {'id': 'course-001', 'title': 'Flutter Basics'},
          'course',
        );
        expect(item.id, 'course-001');
        expect(item.title, 'Flutter Basics');
        expect(item.type, 'course');
      });

      test('uses title field as title for announcements', () {
        final item = SearchItem.fromJson(
          {'id': 'ann-001', 'title': 'Welcome!'},
          'announcement',
        );
        expect(item.id, 'ann-001');
        expect(item.title, 'Welcome!');
        expect(item.type, 'announcement');
      });

      test('prefers name over title when both present', () {
        final item = SearchItem.fromJson(
          {'id': '1', 'name': 'Name Value', 'title': 'Title Value'},
          'batch',
        );
        // ?? operator: name is checked first
        expect(item.title, 'Name Value');
      });

      test('falls back to title when name is null', () {
        final item = SearchItem.fromJson(
          {'id': '1', 'name': null, 'title': 'Title Value'},
          'course',
        );
        expect(item.title, 'Title Value');
      });

      test('handles missing name and title', () {
        final item = SearchItem.fromJson(
          {'id': '1'},
          'batch',
        );
        expect(item.title, '');
      });

      test('handles missing id', () {
        final item = SearchItem.fromJson(
          {'name': 'Test'},
          'batch',
        );
        expect(item.id, '');
      });

      test('converts non-string id via toString', () {
        final item = SearchItem.fromJson(
          {'id': 123, 'name': 'Test'},
          'batch',
        );
        expect(item.id, '123');
      });
    });
  });
}

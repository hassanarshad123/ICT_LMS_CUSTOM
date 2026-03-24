import 'package:flutter_test/flutter_test.dart';
import 'package:ict_lms_student/models/notification_out.dart';

void main() {
  group('NotificationOut', () {
    final fullJson = <String, dynamic>{
      'id': 'notif-001',
      'type': 'announcement',
      'title': 'New Assignment',
      'message': 'Assignment 3 has been posted for your batch.',
      'link': '/batches/batch-001/announcements/ann-001',
      'read': false,
      'createdAt': '2026-03-15T14:30:00.000Z',
    };

    group('fromJson', () {
      test('parses all fields correctly', () {
        final notif = NotificationOut.fromJson(fullJson);

        expect(notif.id, 'notif-001');
        expect(notif.type, 'announcement');
        expect(notif.title, 'New Assignment');
        expect(notif.message, 'Assignment 3 has been posted for your batch.');
        expect(notif.link, '/batches/batch-001/announcements/ann-001');
        expect(notif.read, false);
        expect(notif.createdAt, isA<DateTime>());
        expect(notif.createdAt!.year, 2026);
        expect(notif.createdAt!.month, 3);
        expect(notif.createdAt!.day, 15);
      });

      test('handles nullable fields as null', () {
        final json = <String, dynamic>{
          'id': 'notif-002',
          'type': 'system',
          'title': 'System Update',
          'message': 'Maintenance scheduled.',
        };
        final notif = NotificationOut.fromJson(json);

        expect(notif.link, isNull);
        expect(notif.read, false);
        expect(notif.createdAt, isNull);
      });

      test('handles missing keys gracefully', () {
        final json = <String, dynamic>{'id': 'notif-003'};
        final notif = NotificationOut.fromJson(json);

        expect(notif.id, 'notif-003');
        expect(notif.type, '');
        expect(notif.title, '');
        expect(notif.message, '');
        expect(notif.link, isNull);
        expect(notif.read, false);
      });

      test('handles empty map', () {
        final notif = NotificationOut.fromJson(<String, dynamic>{});
        expect(notif.id, '');
        expect(notif.type, '');
        expect(notif.title, '');
        expect(notif.message, '');
      });

      test('read defaults to false when missing', () {
        final json = <String, dynamic>{
          'id': 'notif-004',
          'type': 'info',
          'title': 'Test',
          'message': 'Test message',
        };
        final notif = NotificationOut.fromJson(json);
        expect(notif.read, false);
      });

      test('read can be true', () {
        final json = <String, dynamic>{
          'id': 'notif-005',
          'type': 'info',
          'title': 'Read Notification',
          'message': 'Already read.',
          'read': true,
        };
        final notif = NotificationOut.fromJson(json);
        expect(notif.read, true);
      });

      test('handles invalid date string', () {
        final json = <String, dynamic>{
          'id': 'notif-006',
          'createdAt': 'invalid',
        };
        final notif = NotificationOut.fromJson(json);
        expect(notif.createdAt, isNull);
      });
    });

    group('toJson', () {
      test('produces correct map', () {
        final notif = NotificationOut.fromJson(fullJson);
        final json = notif.toJson();

        expect(json['id'], 'notif-001');
        expect(json['type'], 'announcement');
        expect(json['title'], 'New Assignment');
        expect(json['message'], contains('Assignment 3'));
        expect(json['link'], contains('/announcements/'));
        expect(json['read'], false);
        expect(json['createdAt'], isA<String>());
      });

      test('round-trip preserves data', () {
        final notif = NotificationOut.fromJson(fullJson);
        final roundTripped = NotificationOut.fromJson(notif.toJson());

        expect(roundTripped, equals(notif));
        expect(roundTripped.type, notif.type);
        expect(roundTripped.title, notif.title);
        expect(roundTripped.message, notif.message);
        expect(roundTripped.link, notif.link);
        expect(roundTripped.read, notif.read);
      });
    });

    group('copyWith', () {
      test('changes single field', () {
        final notif = NotificationOut.fromJson(fullJson);
        final changed = notif.copyWith(title: 'Updated Title');

        expect(changed.title, 'Updated Title');
        expect(changed.id, notif.id);
        expect(changed.type, notif.type);
      });

      test('marks as read', () {
        final notif = NotificationOut.fromJson(fullJson);
        expect(notif.read, false);

        final readNotif = notif.copyWith(read: true);
        expect(readNotif.read, true);
        expect(notif.read, false); // original unchanged
      });

      test('no-change returns equal object', () {
        final notif = NotificationOut.fromJson(fullJson);
        final copy = notif.copyWith();
        expect(copy, equals(notif));
      });
    });

    group('isUnread', () {
      test('returns true when read is false', () {
        final notif = NotificationOut.fromJson(fullJson);
        expect(notif.isUnread, true);
      });

      test('returns false when read is true', () {
        final notif = NotificationOut.fromJson({...fullJson, 'read': true});
        expect(notif.isUnread, false);
      });
    });

    group('equality', () {
      test('equal by id', () {
        final notif1 = NotificationOut.fromJson(fullJson);
        final notif2 =
            NotificationOut.fromJson({...fullJson, 'title': 'Different'});
        expect(notif1, equals(notif2));
      });

      test('not equal with different id', () {
        final notif1 = NotificationOut.fromJson(fullJson);
        final notif2 =
            NotificationOut.fromJson({...fullJson, 'id': 'notif-999'});
        expect(notif1, isNot(equals(notif2)));
      });

      test('hashCode based on id', () {
        final notif1 = NotificationOut.fromJson(fullJson);
        final notif2 =
            NotificationOut.fromJson({...fullJson, 'title': 'Different'});
        expect(notif1.hashCode, equals(notif2.hashCode));
      });
    });

    test('toString includes key fields', () {
      final notif = NotificationOut.fromJson(fullJson);
      final str = notif.toString();
      expect(str, contains('notif-001'));
      expect(str, contains('New Assignment'));
      expect(str, contains('false'));
    });
  });

  group('UnreadCountOut', () {
    test('fromJson parses count', () {
      final result =
          UnreadCountOut.fromJson(<String, dynamic>{'count': 5});
      expect(result.count, 5);
    });

    test('fromJson defaults count to 0', () {
      final result = UnreadCountOut.fromJson(<String, dynamic>{});
      expect(result.count, 0);
    });

    test('toJson produces correct map', () {
      const result = UnreadCountOut(count: 3);
      expect(result.toJson(), {'count': 3});
    });

    test('round-trip preserves data', () {
      const original = UnreadCountOut(count: 7);
      final roundTripped = UnreadCountOut.fromJson(original.toJson());
      expect(roundTripped.count, 7);
    });

    test('toString includes count', () {
      const result = UnreadCountOut(count: 10);
      expect(result.toString(), contains('10'));
    });
  });
}

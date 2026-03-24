import 'package:flutter_test/flutter_test.dart';
import 'package:ict_lms_student/models/auth_user.dart';

void main() {
  group('AuthUser', () {
    final fullJson = <String, dynamic>{
      'id': 'user-001',
      'email': 'student@test.com',
      'name': 'Test Student',
      'phone': '+1234567890',
      'role': 'student',
      'status': 'active',
      'avatarUrl': 'https://cdn.example.com/avatar.png',
      'batchIds': ['batch-001', 'batch-002'],
      'batchNames': ['Batch A', 'Batch B'],
      'instituteId': 'inst-001',
      'instituteSlug': 'test-institute',
    };

    group('fromJson', () {
      test('parses all fields correctly', () {
        final user = AuthUser.fromJson(fullJson);

        expect(user.id, 'user-001');
        expect(user.email, 'student@test.com');
        expect(user.name, 'Test Student');
        expect(user.phone, '+1234567890');
        expect(user.role, 'student');
        expect(user.status, 'active');
        expect(user.avatarUrl, 'https://cdn.example.com/avatar.png');
        expect(user.batchIds, ['batch-001', 'batch-002']);
        expect(user.batchNames, ['Batch A', 'Batch B']);
        expect(user.instituteId, 'inst-001');
        expect(user.instituteSlug, 'test-institute');
      });

      test('handles minimal/null fields with defaults', () {
        final json = <String, dynamic>{
          'id': 'user-002',
          'email': 'min@test.com',
          'name': 'Min User',
          'role': 'student',
        };
        final user = AuthUser.fromJson(json);

        expect(user.id, 'user-002');
        expect(user.phone, isNull);
        expect(user.status, 'active');
        expect(user.avatarUrl, isNull);
        expect(user.batchIds, isEmpty);
        expect(user.batchNames, isEmpty);
        expect(user.instituteId, isNull);
        expect(user.instituteSlug, isNull);
      });

      test('handles missing keys gracefully', () {
        final json = <String, dynamic>{'id': 'user-003'};
        final user = AuthUser.fromJson(json);

        expect(user.id, 'user-003');
        expect(user.email, '');
        expect(user.name, '');
        expect(user.role, 'student');
        expect(user.status, 'active');
        expect(user.batchIds, isEmpty);
        expect(user.batchNames, isEmpty);
      });

      test('handles empty map', () {
        final user = AuthUser.fromJson(<String, dynamic>{});
        expect(user.id, '');
        expect(user.email, '');
        expect(user.name, '');
        expect(user.role, 'student');
      });

      test('converts non-string id via toString', () {
        final json = <String, dynamic>{
          'id': 12345,
          'email': 'test@test.com',
          'name': 'Test',
          'role': 'admin',
        };
        final user = AuthUser.fromJson(json);
        expect(user.id, '12345');
      });

      test('converts batchIds with mixed types', () {
        final json = <String, dynamic>{
          'id': 'user-004',
          'batchIds': [1, 'batch-str', 42],
        };
        final user = AuthUser.fromJson(json);
        expect(user.batchIds, ['1', 'batch-str', '42']);
      });
    });

    group('toJson', () {
      test('produces correct map with all fields', () {
        final user = AuthUser.fromJson(fullJson);
        final json = user.toJson();

        expect(json['id'], 'user-001');
        expect(json['email'], 'student@test.com');
        expect(json['name'], 'Test Student');
        expect(json['phone'], '+1234567890');
        expect(json['role'], 'student');
        expect(json['status'], 'active');
        expect(json['avatarUrl'], 'https://cdn.example.com/avatar.png');
        expect(json['batchIds'], ['batch-001', 'batch-002']);
        expect(json['batchNames'], ['Batch A', 'Batch B']);
        expect(json['instituteId'], 'inst-001');
        expect(json['instituteSlug'], 'test-institute');
      });

      test('includes null fields in output', () {
        final user = AuthUser.fromJson(<String, dynamic>{'id': 'user-005'});
        final json = user.toJson();

        expect(json.containsKey('phone'), true);
        expect(json['phone'], isNull);
        expect(json.containsKey('avatarUrl'), true);
        expect(json['avatarUrl'], isNull);
      });

      test('round-trip preserves data', () {
        final user = AuthUser.fromJson(fullJson);
        final roundTripped = AuthUser.fromJson(user.toJson());

        expect(roundTripped, equals(user));
        expect(roundTripped.email, user.email);
        expect(roundTripped.name, user.name);
        expect(roundTripped.phone, user.phone);
        expect(roundTripped.role, user.role);
        expect(roundTripped.status, user.status);
        expect(roundTripped.avatarUrl, user.avatarUrl);
        expect(roundTripped.batchIds, user.batchIds);
        expect(roundTripped.batchNames, user.batchNames);
        expect(roundTripped.instituteId, user.instituteId);
        expect(roundTripped.instituteSlug, user.instituteSlug);
      });
    });

    group('copyWith', () {
      test('changes single field', () {
        final user = AuthUser.fromJson(fullJson);
        final changed = user.copyWith(name: 'New Name');

        expect(changed.name, 'New Name');
        expect(changed.id, user.id);
        expect(changed.email, user.email);
        expect(changed.role, user.role);
      });

      test('changes multiple fields', () {
        final user = AuthUser.fromJson(fullJson);
        final changed = user.copyWith(
          email: 'new@test.com',
          role: 'admin',
          status: 'inactive',
        );

        expect(changed.email, 'new@test.com');
        expect(changed.role, 'admin');
        expect(changed.status, 'inactive');
        expect(changed.id, user.id);
        expect(changed.name, user.name);
      });

      test('no-change returns equal object', () {
        final user = AuthUser.fromJson(fullJson);
        final copy = user.copyWith();
        expect(copy, equals(user));
      });

      test('replaces batchIds list', () {
        final user = AuthUser.fromJson(fullJson);
        final changed = user.copyWith(batchIds: ['new-batch']);
        expect(changed.batchIds, ['new-batch']);
        expect(user.batchIds, ['batch-001', 'batch-002']);
      });
    });

    group('equality', () {
      test('equal by id', () {
        final user1 = AuthUser.fromJson(fullJson);
        final user2 = AuthUser.fromJson({...fullJson, 'name': 'Different'});
        expect(user1, equals(user2));
      });

      test('not equal with different id', () {
        final user1 = AuthUser.fromJson(fullJson);
        final user2 = AuthUser.fromJson({...fullJson, 'id': 'user-999'});
        expect(user1, isNot(equals(user2)));
      });

      test('hashCode based on id', () {
        final user1 = AuthUser.fromJson(fullJson);
        final user2 = AuthUser.fromJson({...fullJson, 'name': 'Different'});
        expect(user1.hashCode, equals(user2.hashCode));
      });

      test('different id produces different hashCode', () {
        final user1 = AuthUser.fromJson(fullJson);
        final user2 = AuthUser.fromJson({...fullJson, 'id': 'user-999'});
        expect(user1.hashCode, isNot(equals(user2.hashCode)));
      });
    });

    test('toString includes key fields', () {
      final user = AuthUser.fromJson(fullJson);
      final str = user.toString();
      expect(str, contains('user-001'));
      expect(str, contains('student@test.com'));
      expect(str, contains('Test Student'));
      expect(str, contains('student'));
    });
  });
}

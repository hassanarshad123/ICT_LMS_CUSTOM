import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:ict_lms_student/core/utils/jwt_decoder.dart';

/// Builds a fake JWT string with the given payload claims.
///
/// The header and signature are dummy values; only the payload matters
/// for the functions under test.
String _buildJwt(Map<String, dynamic> payload) {
  final header = base64Url.encode(utf8.encode('{"alg":"HS256","typ":"JWT"}'));
  final payloadStr = base64Url.encode(utf8.encode(jsonEncode(payload)));
  const signature = 'fake-signature';
  return '$header.$payloadStr.$signature';
}

void main() {
  group('decodeJwtPayload', () {
    test('decodes a valid JWT payload', () {
      final token = _buildJwt({
        'sub': 'user-001',
        'exp': 1700000000,
        'role': 'student',
      });

      final payload = decodeJwtPayload(token);

      expect(payload['sub'], 'user-001');
      expect(payload['exp'], 1700000000);
      expect(payload['role'], 'student');
    });

    test('throws FormatException for token with fewer than 3 parts', () {
      expect(
        () => decodeJwtPayload('only-one-part'),
        throwsA(isA<FormatException>()),
      );
    });

    test('throws FormatException for token with 2 parts', () {
      expect(
        () => decodeJwtPayload('part1.part2'),
        throwsA(isA<FormatException>()),
      );
    });

    test('throws FormatException for empty string', () {
      expect(
        () => decodeJwtPayload(''),
        throwsA(isA<FormatException>()),
      );
    });

    test('handles payload with special characters', () {
      final token = _buildJwt({
        'sub': 'user@test.com',
        'name': 'Test User / Admin',
        'exp': 1700000000,
      });

      final payload = decodeJwtPayload(token);
      expect(payload['sub'], 'user@test.com');
      expect(payload['name'], 'Test User / Admin');
    });

    test('handles payload with nested objects', () {
      final token = _buildJwt({
        'sub': 'user-001',
        'exp': 1700000000,
        'metadata': {'key': 'value'},
      });

      final payload = decodeJwtPayload(token);
      expect(payload['metadata'], isA<Map>());
      expect(payload['metadata']['key'], 'value');
    });
  });

  group('getJwtExp', () {
    test('returns exp claim from valid JWT', () {
      final token = _buildJwt({'exp': 1700000000});
      expect(getJwtExp(token), 1700000000);
    });

    test('throws on JWT without exp claim', () {
      final token = _buildJwt({'sub': 'user-001'});
      expect(
        () => getJwtExp(token),
        throwsA(isA<TypeError>()),
      );
    });
  });

  group('getJwtSub', () {
    test('returns sub claim from valid JWT', () {
      final token = _buildJwt({'sub': 'user-001', 'exp': 1700000000});
      expect(getJwtSub(token), 'user-001');
    });

    test('returns null when sub is missing', () {
      final token = _buildJwt({'exp': 1700000000});
      expect(getJwtSub(token), isNull);
    });
  });

  group('isTokenExpired', () {
    test('returns false for token expiring far in the future', () {
      // Set exp to year ~2100
      final futureExp =
          (DateTime(2100, 1, 1).millisecondsSinceEpoch ~/ 1000);
      final token = _buildJwt({'exp': futureExp});

      expect(isTokenExpired(token), false);
    });

    test('returns true for token that expired in the past', () {
      // Set exp to year 2000
      final pastExp =
          (DateTime(2000, 1, 1).millisecondsSinceEpoch ~/ 1000);
      final token = _buildJwt({'exp': pastExp});

      expect(isTokenExpired(token), true);
    });

    test('returns true when token expires within bufferSeconds', () {
      // Set exp to 30 seconds from now
      final soonExp =
          (DateTime.now().millisecondsSinceEpoch ~/ 1000) + 30;
      final token = _buildJwt({'exp': soonExp});

      // With 60 second buffer, should be considered expired
      expect(isTokenExpired(token, bufferSeconds: 60), true);
    });

    test('returns false when token expires beyond bufferSeconds', () {
      // Set exp to 120 seconds from now
      final laterExp =
          (DateTime.now().millisecondsSinceEpoch ~/ 1000) + 120;
      final token = _buildJwt({'exp': laterExp});

      // With 30 second buffer, should NOT be considered expired
      expect(isTokenExpired(token, bufferSeconds: 30), false);
    });

    test('returns true for malformed token', () {
      expect(isTokenExpired('not.a.valid-jwt'), true);
    });

    test('returns true for empty string', () {
      expect(isTokenExpired(''), true);
    });

    test('returns true for token missing exp claim', () {
      final token = _buildJwt({'sub': 'user-001'});
      expect(isTokenExpired(token), true);
    });

    test('bufferSeconds of 0 uses exact expiration', () {
      // Set exp to 5 seconds from now — should NOT be expired with 0 buffer
      final soonExp =
          (DateTime.now().millisecondsSinceEpoch ~/ 1000) + 5;
      final token = _buildJwt({'exp': soonExp});

      expect(isTokenExpired(token, bufferSeconds: 0), false);
    });
  });
}

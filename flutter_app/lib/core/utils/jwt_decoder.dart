import 'dart:convert';

/// Decodes a JWT payload (base64url -> JSON map).
Map<String, dynamic> decodeJwtPayload(String token) {
  final parts = token.split('.');
  if (parts.length != 3) {
    throw const FormatException('Invalid JWT');
  }

  final payload = parts[1];
  // Normalize base64url to base64
  final normalized = base64Url.normalize(payload);
  final decoded = utf8.decode(base64Url.decode(normalized));
  return jsonDecode(decoded) as Map<String, dynamic>;
}

/// Returns the expiration timestamp (seconds since epoch) from a JWT.
int getJwtExp(String token) {
  final payload = decodeJwtPayload(token);
  return payload['exp'] as int;
}

/// Returns the subject (user ID) from a JWT.
String? getJwtSub(String token) {
  final payload = decodeJwtPayload(token);
  return payload['sub'] as String?;
}

/// Checks if a JWT is expired (or will expire within [bufferSeconds]).
bool isTokenExpired(String token, {int bufferSeconds = 0}) {
  try {
    final exp = getJwtExp(token);
    final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    return now >= (exp - bufferSeconds);
  } catch (_) {
    return true;
  }
}

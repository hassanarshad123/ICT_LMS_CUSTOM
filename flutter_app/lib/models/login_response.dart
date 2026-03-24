import 'auth_user.dart';

/// Matches LoginResponse from backend/app/schemas/auth.py.
/// Field names are camelCase -- Dio interceptor converts from snake_case.
class LoginResponse {
  final String accessToken;
  final String refreshToken;
  final String tokenType;
  final AuthUser user;

  const LoginResponse({
    required this.accessToken,
    required this.refreshToken,
    this.tokenType = 'bearer',
    required this.user,
  });

  factory LoginResponse.fromJson(Map<String, dynamic> json) {
    return LoginResponse(
      accessToken: json['accessToken'] as String? ?? '',
      refreshToken: json['refreshToken'] as String? ?? '',
      tokenType: json['tokenType'] as String? ?? 'bearer',
      user: AuthUser.fromJson(json['user'] as Map<String, dynamic>),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'accessToken': accessToken,
      'refreshToken': refreshToken,
      'tokenType': tokenType,
      'user': user.toJson(),
    };
  }

  @override
  String toString() =>
      'LoginResponse(tokenType: $tokenType, user: ${user.email})';
}

/// Matches RefreshResponse from backend/app/schemas/auth.py.
/// Returned by POST /auth/refresh.
class TokenResponse {
  final String accessToken;
  final String refreshToken;
  final String tokenType;

  const TokenResponse({
    required this.accessToken,
    required this.refreshToken,
    this.tokenType = 'bearer',
  });

  factory TokenResponse.fromJson(Map<String, dynamic> json) {
    return TokenResponse(
      accessToken: json['accessToken'] as String? ?? '',
      refreshToken: json['refreshToken'] as String? ?? '',
      tokenType: json['tokenType'] as String? ?? 'bearer',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'accessToken': accessToken,
      'refreshToken': refreshToken,
      'tokenType': tokenType,
    };
  }
}

/// Matches LogoutAllResponse from backend/app/schemas/auth.py.
class LogoutAllResponse {
  final String detail;
  final int sessionsTerminated;

  const LogoutAllResponse({
    required this.detail,
    required this.sessionsTerminated,
  });

  factory LogoutAllResponse.fromJson(Map<String, dynamic> json) {
    return LogoutAllResponse(
      detail: json['detail'] as String? ?? '',
      sessionsTerminated: json['sessionsTerminated'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'detail': detail,
      'sessionsTerminated': sessionsTerminated,
    };
  }
}

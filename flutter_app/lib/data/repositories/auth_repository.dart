import 'package:dio/dio.dart';
import '../../core/constants/api_constants.dart';
import '../../models/auth_user.dart';
import '../../models/login_response.dart';

/// Repository for all auth-related API calls.
///
/// Takes an authenticated Dio instance (with auth interceptor, case converter,
/// slug interceptor, and error mapping interceptor).
///
/// Endpoints match backend/app/routers/auth.py.
class AuthRepository {
  final Dio _dio;

  AuthRepository(this._dio);

  /// POST /auth/login
  ///
  /// Body: { email, password, deviceInfo? }
  /// Returns: LoginResponse { accessToken, refreshToken, tokenType, user }
  ///
  /// Note: The Dio case converter automatically converts camelCase keys
  /// to snake_case in the request body.
  Future<LoginResponse> login(
    String email,
    String password, {
    String? deviceInfo,
  }) async {
    final response = await _dio.post(
      ApiConstants.login,
      data: {
        'email': email,
        'password': password,
        if (deviceInfo != null) 'deviceInfo': deviceInfo,
      },
    );
    return LoginResponse.fromJson(response.data as Map<String, dynamic>);
  }

  /// POST /auth/refresh
  ///
  /// Body: { refreshToken }
  /// Returns: TokenResponse { accessToken, tokenType }
  Future<TokenResponse> refresh(String refreshToken) async {
    final response = await _dio.post(
      ApiConstants.refresh,
      data: {'refreshToken': refreshToken},
    );
    return TokenResponse.fromJson(response.data as Map<String, dynamic>);
  }

  /// POST /auth/logout
  ///
  /// Body: { refreshToken }
  /// Invalidates a single session.
  Future<void> logout(String refreshToken) async {
    await _dio.post(
      ApiConstants.logout,
      data: {'refreshToken': refreshToken},
    );
  }

  /// POST /auth/logout-all
  ///
  /// No body required (uses auth token).
  /// Returns: LogoutAllResponse { detail, sessionsTerminated }
  Future<LogoutAllResponse> logoutAll() async {
    final response = await _dio.post(ApiConstants.logoutAll);
    return LogoutAllResponse.fromJson(response.data as Map<String, dynamic>);
  }

  /// POST /auth/change-password
  ///
  /// Body: { currentPassword, newPassword }
  /// Logs out all sessions after password change.
  Future<void> changePassword(
    String currentPassword,
    String newPassword,
  ) async {
    await _dio.post(
      ApiConstants.changePassword,
      data: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      },
    );
  }

  /// GET /auth/me
  ///
  /// Validates the current token and returns user info.
  /// Returns: AuthUser (UserBrief on backend)
  Future<AuthUser> getMe() async {
    final response = await _dio.get(ApiConstants.me);
    return AuthUser.fromJson(response.data as Map<String, dynamic>);
  }

  /// POST /auth/forgot-password
  ///
  /// Body: { email }
  /// Always returns 200 to prevent email enumeration.
  /// Returns: detail message string.
  Future<String> forgotPassword(String email) async {
    final response = await _dio.post(
      ApiConstants.forgotPassword,
      data: {'email': email},
    );
    final data = response.data as Map<String, dynamic>;
    return data['detail'] as String? ?? '';
  }

  /// POST /auth/reset-password
  ///
  /// Body: { token, newPassword }
  /// Returns: detail message string.
  Future<String> resetPassword(String token, String newPassword) async {
    final response = await _dio.post(
      ApiConstants.resetPassword,
      data: {'token': token, 'newPassword': newPassword},
    );
    final data = response.data as Map<String, dynamic>;
    return data['detail'] as String? ?? '';
  }

  /// POST /auth/verify-email
  ///
  /// Body: { token }
  /// Returns: detail message string.
  Future<String> verifyEmail(String token) async {
    final response = await _dio.post(
      '${ApiConstants.authPrefix}/verify-email',
      data: {'token': token},
    );
    final data = response.data as Map<String, dynamic>;
    return data['detail'] as String? ?? '';
  }

  /// POST /auth/resend-verification
  ///
  /// Body: { email }
  /// Always returns 200 (prevents email enumeration).
  Future<void> resendVerification(String email) async {
    await _dio.post(
      '${ApiConstants.authPrefix}/resend-verification',
      data: {'email': email},
    );
  }
}

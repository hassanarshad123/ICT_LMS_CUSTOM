import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../constants/api_constants.dart';
import '../constants/storage_keys.dart';
import '../utils/jwt_decoder.dart';

class AuthInterceptor extends Interceptor {
  final Dio _refreshDio;
  final FlutterSecureStorage _secureStorage;
  final VoidCallback onForceLogout;

  Completer<String?>? _refreshCompleter;

  AuthInterceptor({
    required Dio refreshDio,
    required FlutterSecureStorage secureStorage,
    required this.onForceLogout,
  })  : _refreshDio = refreshDio,
        _secureStorage = secureStorage;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _secureStorage.read(key: StorageKeys.accessToken);
    if (token != null) {
      // Proactive refresh: if token expires within 30 seconds
      if (isTokenExpired(token, bufferSeconds: 30)) {
        final newToken = await _tryRefresh();
        if (newToken != null) {
          options.headers['Authorization'] = 'Bearer $newToken';
        } else {
          // Refresh failed -- proceed anyway, will get 401
          options.headers['Authorization'] = 'Bearer $token';
        }
      } else {
        options.headers['Authorization'] = 'Bearer $token';
      }
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (err.response?.statusCode == 401) {
      final newToken = await _tryRefresh();
      if (newToken != null) {
        // Retry original request with new token
        final options = err.requestOptions;
        options.headers['Authorization'] = 'Bearer $newToken';
        try {
          final response = await _refreshDio.fetch(options);
          return handler.resolve(response);
        } catch (e) {
          return handler.next(err);
        }
      } else {
        onForceLogout();
      }
    }
    handler.next(err);
  }

  /// Deduplicates concurrent refresh calls using a Completer.
  Future<String?> _tryRefresh() async {
    if (_refreshCompleter != null) {
      return _refreshCompleter!.future;
    }

    _refreshCompleter = Completer<String?>();
    try {
      final refreshToken = await _secureStorage.read(
        key: StorageKeys.refreshToken,
      );
      if (refreshToken == null) {
        _refreshCompleter!.complete(null);
        return null;
      }

      final response = await _refreshDio.post(
        '${ApiConstants.baseUrl}${ApiConstants.refresh}',
        data: {'refreshToken': refreshToken},
      );

      final newAccessToken = response.data['accessToken'] as String?;
      final newRefreshToken = response.data['refreshToken'] as String?;
      if (newAccessToken != null) {
        await _secureStorage.write(
          key: StorageKeys.accessToken,
          value: newAccessToken,
        );
        // Rotate refresh token — backend invalidates the old one
        if (newRefreshToken != null) {
          await _secureStorage.write(
            key: StorageKeys.refreshToken,
            value: newRefreshToken,
          );
        }
        _refreshCompleter!.complete(newAccessToken);
        return newAccessToken;
      }

      _refreshCompleter!.complete(null);
      return null;
    } catch (e) {
      _refreshCompleter!.complete(null);
      return null;
    } finally {
      _refreshCompleter = null;
    }
  }
}

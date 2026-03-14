import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../main.dart';
import '../constants/api_constants.dart';
import '../errors/api_exception.dart';
import 'auth_interceptor.dart';
import 'case_converter.dart';
import 'slug_interceptor.dart';

/// Provider for the main authenticated Dio client (with all interceptors).
///
/// Used by all authenticated repositories (batches, courses, zoom, etc.).
/// Creates a Dio with slug, auth, case-convert, and error-mapping interceptors.
final dioProvider = Provider<Dio>((ref) {
  final prefs = ref.watch(sharedPreferencesProvider);
  const secureStorage = FlutterSecureStorage();

  return createAuthenticatedDio(
    prefs: prefs,
    secureStorage: secureStorage,
    onForceLogout: () {
      // Clear tokens directly — the auth provider's restoreSession()
      // will detect the missing token on next check and reset state.
      secureStorage.deleteAll();
    },
  );
});

/// Provider for a public Dio client (no auth, only slug + case conversion).
final publicDioProvider = Provider<Dio>((ref) {
  final prefs = ref.watch(sharedPreferencesProvider);
  final dio = Dio(BaseOptions(
    baseUrl: ApiConstants.baseUrl,
    connectTimeout: ApiConstants.connectTimeout,
    receiveTimeout: ApiConstants.requestTimeout,
  ));

  dio.interceptors.addAll([
    SlugInterceptor(prefs),
    _CaseConvertInterceptor(),
    _ErrorMappingInterceptor(),
  ]);

  return dio;
});

/// Interceptor that converts request body keys camelCase -> snake_case
/// and response data keys snake_case -> camelCase.
class _CaseConvertInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (options.data is Map) {
      options.data = convertKeysToSnake(options.data);
    }
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    if (response.data is Map || response.data is List) {
      response.data = convertKeysToCamel(response.data);
    }
    handler.next(response);
  }
}

/// Interceptor that maps DioException types to typed ApiException subtypes.
class _ErrorMappingInterceptor extends Interceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final statusCode = err.response?.statusCode;
    final detail = _extractDetail(err.response?.data);

    ApiException? apiException;

    switch (err.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        apiException = const TimeoutException();
        break;
      case DioExceptionType.connectionError:
        apiException = const NetworkException();
        break;
      default:
        if (statusCode != null) {
          apiException = switch (statusCode) {
            401 => UnauthorizedException(detail),
            403 => ForbiddenException(detail),
            404 => NotFoundException(detail),
            409 => ConflictException(detail),
            422 => ValidationException(detail),
            >= 500 => ServerException(detail),
            _ => ServerException(detail),
          };
        }
    }

    if (apiException != null) {
      handler.reject(
        DioException(
          requestOptions: err.requestOptions,
          response: err.response,
          type: err.type,
          error: apiException,
        ),
      );
    } else {
      handler.next(err);
    }
  }

  String _extractDetail(dynamic data) {
    if (data is Map) {
      return data['detail']?.toString() ?? 'Something went wrong';
    }
    return 'Something went wrong';
  }
}

/// Creates a fully configured Dio instance with all interceptors.
Dio createAuthenticatedDio({
  required SharedPreferences prefs,
  required FlutterSecureStorage secureStorage,
  required VoidCallback onForceLogout,
}) {
  final dio = Dio(BaseOptions(
    baseUrl: ApiConstants.baseUrl,
    connectTimeout: ApiConstants.connectTimeout,
    receiveTimeout: ApiConstants.requestTimeout,
  ));

  // Separate Dio for refresh calls (avoids interceptor loop)
  final refreshDio = Dio(BaseOptions(
    baseUrl: ApiConstants.baseUrl,
    connectTimeout: ApiConstants.connectTimeout,
    receiveTimeout: ApiConstants.requestTimeout,
  ));
  refreshDio.interceptors.add(SlugInterceptor(prefs));

  dio.interceptors.addAll([
    SlugInterceptor(prefs),
    AuthInterceptor(
      refreshDio: refreshDio,
      secureStorage: secureStorage,
      onForceLogout: onForceLogout,
    ),
    _CaseConvertInterceptor(),
    _ErrorMappingInterceptor(),
  ]);

  return dio;
}

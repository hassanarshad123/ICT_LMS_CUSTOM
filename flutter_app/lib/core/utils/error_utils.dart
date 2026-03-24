import 'package:dio/dio.dart';
import '../errors/api_exception.dart';

/// Extracts a user-friendly error message from any exception.
///
/// Priority:
/// 1. DioException wrapping an ApiException → use ApiException.message
/// 2. DioException with response data containing 'detail' → use that
/// 3. Exception → strip "Exception: " prefix
/// 4. Fallback → 'Something went wrong'
String extractErrorMessage(dynamic error) {
  if (error is DioException) {
    // Check for typed ApiException from ErrorMappingInterceptor
    if (error.error is ApiException) {
      return (error.error as ApiException).message;
    }
    // Check raw response detail field
    final data = error.response?.data;
    if (data is Map) {
      final detail = data['detail']?.toString();
      if (detail != null && detail.isNotEmpty) return detail;
    }
    // Connection/timeout messages
    if (error.type == DioExceptionType.connectionError) {
      return 'No internet connection';
    }
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.sendTimeout ||
        error.type == DioExceptionType.receiveTimeout) {
      return 'Request timed out';
    }
    return 'Something went wrong';
  }

  if (error is ApiException) {
    return error.message;
  }

  final str = error.toString();
  if (str.startsWith('Exception: ')) {
    return str.substring('Exception: '.length);
  }
  return str.isNotEmpty ? str : 'Something went wrong';
}

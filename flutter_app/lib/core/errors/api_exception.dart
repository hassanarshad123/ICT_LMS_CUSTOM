sealed class ApiException implements Exception {
  final String message;
  final int? statusCode;
  const ApiException(this.message, {this.statusCode});

  @override
  String toString() => message;
}

class UnauthorizedException extends ApiException {
  const UnauthorizedException([String message = 'Unauthorized'])
      : super(message, statusCode: 401);
}

class ForbiddenException extends ApiException {
  const ForbiddenException([String message = 'Forbidden'])
      : super(message, statusCode: 403);
}

class NotFoundException extends ApiException {
  const NotFoundException([String message = 'Not found'])
      : super(message, statusCode: 404);
}

class ConflictException extends ApiException {
  const ConflictException([String message = 'Conflict'])
      : super(message, statusCode: 409);
}

class ValidationException extends ApiException {
  const ValidationException([String message = 'Validation error'])
      : super(message, statusCode: 422);
}

class ServerException extends ApiException {
  const ServerException([String message = 'Server error'])
      : super(message, statusCode: 500);
}

class NetworkException extends ApiException {
  const NetworkException([String message = 'No internet connection'])
      : super(message);
}

class TimeoutException extends ApiException {
  const TimeoutException([String message = 'Request timed out'])
      : super(message);
}

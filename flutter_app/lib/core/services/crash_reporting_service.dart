import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

/// Crash reporting via Sentry.
///
/// Wraps Sentry SDK so the rest of the app doesn't depend on Sentry directly.
/// In debug mode, also prints to console for local development.
class CrashReportingService {
  CrashReportingService._();

  static const _dsn = String.fromEnvironment(
    'SENTRY_DSN',
    defaultValue: '',
  );

  /// Initialize Sentry. Call from main() before runApp().
  /// Returns the Sentry options runner for wrapping runApp().
  static Future<void> init(FutureOr<void> Function() appRunner) async {
    if (_dsn.isEmpty) {
      // No DSN configured — run app without Sentry (development mode)
      if (kDebugMode) {
        debugPrint('[CrashReporting] No SENTRY_DSN set, running without Sentry');
      }
      await appRunner();
      return;
    }

    await SentryFlutter.init(
      (options) {
        options.dsn = _dsn;
        options.environment = kDebugMode ? 'development' : 'production';
        options.tracesSampleRate = kDebugMode ? 0.0 : 1.0;
        options.sendDefaultPii = false;
        options.attachScreenshot = !kDebugMode;
      },
      appRunner: appRunner,
    );
  }

  /// Record a non-fatal error.
  static void recordError(
    dynamic error, [
    StackTrace? stackTrace,
    String? reason,
  ]) {
    if (kDebugMode) {
      debugPrint('[CrashReporting] ${reason ?? 'Error'}: $error');
    }
    if (_dsn.isNotEmpty) {
      Sentry.captureException(error, stackTrace: stackTrace);
    }
  }

  /// Set user context for crash reports.
  static void setUser(String userId, String email) {
    if (kDebugMode) {
      debugPrint('[CrashReporting] User set: $userId ($email)');
    }
    if (_dsn.isNotEmpty) {
      Sentry.configureScope((scope) {
        scope.setUser(SentryUser(id: userId, email: email));
      });
    }
  }

  /// Clear user context (on logout).
  static void clearUser() {
    if (kDebugMode) {
      debugPrint('[CrashReporting] User cleared');
    }
    if (_dsn.isNotEmpty) {
      Sentry.configureScope((scope) {
        scope.setUser(null);
      });
    }
  }
}

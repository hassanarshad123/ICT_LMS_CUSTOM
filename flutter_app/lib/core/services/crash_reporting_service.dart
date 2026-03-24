import 'dart:async';
import 'dart:ui';

import 'package:flutter/foundation.dart';

/// Crash reporting service wrapper.
///
/// Currently provides a no-op implementation that logs to console in debug mode.
/// To enable Firebase Crashlytics:
/// 1. Run `flutterfire configure` to generate `firebase_options.dart`
/// 2. Add `firebase_core` and `firebase_crashlytics` to pubspec.yaml
/// 3. Uncomment the Firebase lines below
class CrashReportingService {
  CrashReportingService._();

  static bool _initialized = false;

  /// Initialize crash reporting. Call once in main().
  static Future<void> init() async {
    if (_initialized) return;

    // For now, set up debug error handlers.
    // Replace with Firebase Crashlytics when configured.
    FlutterError.onError = (details) {
      FlutterError.presentError(details);
      if (kDebugMode) {
        debugPrint('[CrashReporting] Flutter error: ${details.exception}');
      }
    };

    PlatformDispatcher.instance.onError = (error, stack) {
      if (kDebugMode) {
        debugPrint('[CrashReporting] Async error: $error\n$stack');
      }
      return true;
    };

    _initialized = true;
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
  }

  /// Set user context for crash reports.
  static void setUser(String userId, String email) {
    if (kDebugMode) {
      debugPrint('[CrashReporting] User set: $userId ($email)');
    }
  }

  /// Clear user context (on logout).
  static void clearUser() {
    if (kDebugMode) {
      debugPrint('[CrashReporting] User cleared');
    }
  }
}

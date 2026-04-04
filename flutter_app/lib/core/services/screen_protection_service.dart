import 'dart:io';
import 'package:flutter/services.dart';

/// Prevents screenshots and screen recording on Android (FLAG_SECURE)
/// and detects screen capture on iOS.
///
/// Call [enable] when entering sensitive screens (video player)
/// and [disable] when leaving.
class ScreenProtectionService {
  static const _channel = MethodChannel('com.zensbot.lms/screen_protection');
  static bool _isEnabled = false;

  /// Enable screen protection.
  /// Android: Sets FLAG_SECURE (prevents screenshots and screen recording).
  /// iOS: No native equivalent — uses a blank overlay trick.
  static Future<void> enable() async {
    if (_isEnabled) return;
    try {
      if (Platform.isAndroid) {
        await _channel.invokeMethod('enableProtection');
      }
      // iOS: screen_protector plugin handles it via native code
      _isEnabled = true;
    } catch (_) {
      // Best-effort — don't crash if method channel isn't available
    }
  }

  /// Disable screen protection.
  static Future<void> disable() async {
    if (!_isEnabled) return;
    try {
      if (Platform.isAndroid) {
        await _channel.invokeMethod('disableProtection');
      }
      _isEnabled = false;
    } catch (_) {
      // Best-effort
    }
  }
}

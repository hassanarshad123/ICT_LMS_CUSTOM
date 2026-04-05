import 'package:flutter/animation.dart';
import 'package:flutter/services.dart';

/// Design system animation tokens.
class AppAnimations {
  AppAnimations._();

  // --- Durations ---
  static const Duration fast = Duration(milliseconds: 150);
  static const Duration normal = Duration(milliseconds: 300);
  static const Duration slow = Duration(milliseconds: 500);
  static const Duration celebration = Duration(milliseconds: 800);

  // --- Curves ---
  static const Curve curveDefault = Curves.easeInOut;
  static const Curve curveEnter = Curves.easeOutCubic;
  static const Curve curveExit = Curves.easeInCubic;
  static const Curve curveSpring = Curves.elasticOut;
  static const Curve curveDecelerate = Curves.decelerate;
  static const Curve curveAppleSpring = Curves.easeOutBack;

  // --- Stagger timing ---
  static const Duration staggerInterval = Duration(milliseconds: 50);
  static const Duration listItemDelay = Duration(milliseconds: 35);

  // --- Standard offsets ---
  static const double slideUpOffset = 20.0;
  static const double slideHorizontalOffset = 16.0;

  // --- Tab cross-fade ---
  static const Duration tabFade = Duration(milliseconds: 200);

  // --- Haptics ---
  static void hapticLight() => HapticFeedback.lightImpact();
  static void hapticMedium() => HapticFeedback.mediumImpact();
  static void hapticHeavy() => HapticFeedback.heavyImpact();
  static void hapticSelection() => HapticFeedback.selectionClick();
}

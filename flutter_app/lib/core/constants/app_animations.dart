import 'package:flutter/animation.dart';

/// Design system animation tokens.
class AppAnimations {
  AppAnimations._();

  // --- Durations ---
  static const Duration fast = Duration(milliseconds: 150);
  static const Duration normal = Duration(milliseconds: 300);
  static const Duration slow = Duration(milliseconds: 500);

  // --- Curves ---
  static const Curve curveDefault = Curves.easeInOut;
  static const Curve curveEnter = Curves.easeOutCubic;
  static const Curve curveExit = Curves.easeInCubic;
  static const Curve curveSpring = Curves.elasticOut;
  static const Curve curveDecelerate = Curves.decelerate;
}

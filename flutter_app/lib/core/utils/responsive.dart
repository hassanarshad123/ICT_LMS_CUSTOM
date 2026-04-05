import 'package:flutter/material.dart';

/// Apple HIG-inspired responsive breakpoints.
///
/// compact:  < 600dp  (all iPhones portrait)
/// medium:   600–1024dp (iPhone landscape, iPad portrait, small tablets)
/// expanded: > 1024dp (iPad landscape, large tablets)
class Responsive {
  Responsive._();

  static const double compactBreakpoint = 600;
  static const double expandedBreakpoint = 1024;

  static bool isCompact(BuildContext context) =>
      MediaQuery.sizeOf(context).width < compactBreakpoint;

  static bool isMedium(BuildContext context) {
    final w = MediaQuery.sizeOf(context).width;
    return w >= compactBreakpoint && w < expandedBreakpoint;
  }

  static bool isExpanded(BuildContext context) =>
      MediaQuery.sizeOf(context).width >= expandedBreakpoint;

  /// Screen horizontal padding: 16 on phone, 24 on tablet portrait, 32 on tablet landscape.
  static double screenPadding(BuildContext context) {
    if (isExpanded(context)) return 32;
    if (isMedium(context)) return 24;
    return 16;
  }

  /// Grid columns for card layouts.
  static int gridColumns(BuildContext context) {
    if (isExpanded(context)) return 3;
    if (isMedium(context)) return 2;
    return 1;
  }

  /// Max content width for centered layouts (profile, quiz, login).
  /// Returns null on compact (full width).
  static double? maxContentWidth(BuildContext context) {
    if (isExpanded(context)) return 720;
    if (isMedium(context)) return 600;
    return null;
  }

  /// Section gap between major content blocks.
  static double sectionGap(BuildContext context) {
    if (isCompact(context)) return 28;
    return 36;
  }

  /// Wraps [child] in a Center + ConstrainedBox on tablet, passthrough on phone.
  static Widget constrainWidth(BuildContext context, {required Widget child}) {
    final maxWidth = maxContentWidth(context);
    if (maxWidth == null) return child;
    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: child,
      ),
    );
  }
}

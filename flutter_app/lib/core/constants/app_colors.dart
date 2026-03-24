import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // Light theme base (Apple-inspired)
  static const Color scaffoldBg = Color(0xFFF2F2F7);    // iOS system background
  static const Color cardBg = Color(0xFFFFFFFF);          // Pure white cards
  static const Color surfaceBg = Color(0xFFFFFFFF);       // White surface
  static const Color inputBg = Color(0xFFF2F2F7);         // iOS gray 6
  static const Color border = Color(0xFFE5E5EA);          // iOS separator
  static const Color divider = Color(0xFFC6C6C8);         // iOS separator opaque

  // Text hierarchy (Apple near-black system)
  static const Color textPrimary = Color(0xFF1D1D1F);     // Apple label
  static const Color textSecondary = Color(0xFF86868B);    // Apple secondary label
  static const Color textTertiary = Color(0xFFAEAEB2);    // Apple tertiary label

  // Default accent (overridden by institute branding)
  static const Color defaultAccent = Color(0xFF007AFF);   // iOS blue

  // Semantic colors (iOS system colors)
  static const Color error = Color(0xFFFF3B30);           // iOS red
  static const Color success = Color(0xFF34C759);         // iOS green
  static const Color warning = Color(0xFFFF9500);         // iOS orange
  static const Color info = Color(0xFF007AFF);            // iOS blue

  // Status colors
  static const Color statusUpcoming = Color(0xFF007AFF);  // Blue
  static const Color statusActive = Color(0xFF34C759);    // Green
  static const Color statusCompleted = Color(0xFF8E8E93); // Gray
  static const Color statusLive = Color(0xFFFF3B30);      // Red
}

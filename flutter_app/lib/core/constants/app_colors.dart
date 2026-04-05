import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // Light theme base — increased contrast between layers
  static const Color scaffoldBg = Color(0xFFEEEEF0);         // Darker gray for more card contrast
  static const Color cardBg = Color(0xFFFFFFFF);              // Pure white cards
  static const Color surfaceBg = Color(0xFFFFFFFF);           // White surface
  static const Color inputBg = Color(0xFFF2F2F7);             // iOS gray 6
  static const Color border = Color(0xFFE0E0E5);              // Visible card border (Notion-like)
  static const Color divider = Color(0xFFC6C6C8);             // iOS separator opaque

  // Header backgrounds — dark sections for contrast
  static const Color headerDark = Color(0xFF1C1C1E);          // Dark header background
  static const Color headerDarkSecondary = Color(0xFF2C2C2E); // Slightly lighter dark

  // Text hierarchy — stronger contrast
  static const Color textPrimary = Color(0xFF1D1D1F);         // Apple label
  static const Color textSecondary = Color(0xFF6E6E73);       // Darker secondary for readability
  static const Color textTertiary = Color(0xFF8E8E93);        // Apple tertiary label
  static const Color textOnDark = Color(0xFFFFFFFF);           // White text on dark headers
  static const Color textOnDarkSecondary = Color(0xB3FFFFFF);  // 70% white on dark

  // Default accent (overridden by institute branding)
  static const Color defaultAccent = Color(0xFF007AFF);       // iOS blue

  // Semantic colors (iOS system colors)
  static const Color error = Color(0xFFFF3B30);               // iOS red
  static const Color success = Color(0xFF34C759);             // iOS green
  static const Color warning = Color(0xFFFF9500);             // iOS orange
  static const Color info = Color(0xFF007AFF);                // iOS blue

  // Status colors
  static const Color statusUpcoming = Color(0xFF007AFF);      // Blue
  static const Color statusActive = Color(0xFF34C759);        // Green
  static const Color statusCompleted = Color(0xFF8E8E93);     // Gray
  static const Color statusLive = Color(0xFFFF3B30);          // Red

  // Glass morphism — nav bar only
  static const Color glassBorder = Color(0x33FFFFFF);         // White at 20%
  static const Color glassBackground = Color(0x0AFFFFFF);     // White at 4%
  static const Color glassShadow = Color(0x14000000);         // Black at 8%
}

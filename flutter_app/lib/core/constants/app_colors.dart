import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // Dark theme base
  static const Color scaffoldBg = Color(0xFF0D0D0D);
  static const Color cardBg = Color(0xFF1A1A1A);
  static const Color surfaceBg = Color(0xFF262626);
  static const Color inputBg = Color(0xFF1F1F1F);

  // Text hierarchy
  static const Color textPrimary = Color(0xFFFFFFFF);
  static const Color textSecondary = Color(0xFF9CA3AF);
  static const Color textTertiary = Color(0xFF6B7280);

  // Default accent (institute default -- overridden by branding)
  static const Color defaultAccent = Color(0xFFC5D86D);

  // Semantic colors
  static const Color error = Color(0xFFEF4444);
  static const Color success = Color(0xFF22C55E);
  static const Color warning = Color(0xFFF59E0B);
  static const Color info = Color(0xFF3B82F6);

  // Status colors
  static const Color statusUpcoming = Color(0xFF3B82F6);
  static const Color statusActive = Color(0xFF22C55E);
  static const Color statusCompleted = Color(0xFF6B7280);
  static const Color statusLive = Color(0xFFEF4444);
}

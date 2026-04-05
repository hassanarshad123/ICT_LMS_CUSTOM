import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../constants/app_colors.dart';
import '../constants/app_spacing.dart';

ThemeData buildTheme(Color accentColor) {
  final base = ThemeData.light();

  return base.copyWith(
    scaffoldBackgroundColor: AppColors.scaffoldBg,
    colorScheme: ColorScheme.light(
      primary: accentColor,
      secondary: accentColor,
      surface: AppColors.cardBg,
      error: AppColors.error,
      onPrimary: Colors.white,
      onSurface: AppColors.textPrimary,
    ),
    cardColor: AppColors.cardBg,
    dividerColor: AppColors.border,

    // AppBar — clean white, thin bottom border
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.cardBg,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      surfaceTintColor: Colors.transparent,
      centerTitle: false,
      titleTextStyle: TextStyle(
        fontFamily: 'Inter',
        color: AppColors.textPrimary,
        fontSize: 17,
        fontWeight: FontWeight.w600,
      ),
      iconTheme: IconThemeData(color: AppColors.textPrimary),
      systemOverlayStyle: SystemUiOverlayStyle.dark,
    ),

    // Bottom nav (will be replaced by custom, but set sensible defaults)
    bottomNavigationBarTheme: BottomNavigationBarThemeData(
      backgroundColor: AppColors.cardBg,
      selectedItemColor: accentColor,
      unselectedItemColor: AppColors.textTertiary,
      type: BottomNavigationBarType.fixed,
      elevation: 0,
    ),

    // Text theme
    textTheme: base.textTheme.apply(fontFamily: 'Inter').copyWith(
      headlineLarge: const TextStyle(
          fontFamily: 'Inter',
          color: AppColors.textPrimary, fontWeight: FontWeight.w700),
      headlineMedium: const TextStyle(
          fontFamily: 'Inter',
          color: AppColors.textPrimary, fontWeight: FontWeight.w600),
      titleLarge: const TextStyle(
          fontFamily: 'Inter',
          color: AppColors.textPrimary, fontWeight: FontWeight.w600),
      titleMedium: const TextStyle(
          fontFamily: 'Inter', color: AppColors.textPrimary),
      bodyLarge: const TextStyle(
          fontFamily: 'Inter', color: AppColors.textPrimary),
      bodyMedium: const TextStyle(
          fontFamily: 'Inter', color: AppColors.textSecondary),
      bodySmall: const TextStyle(
          fontFamily: 'Inter', color: AppColors.textTertiary),
      labelLarge: const TextStyle(
          fontFamily: 'Inter',
          color: AppColors.textPrimary, fontWeight: FontWeight.w600),
    ),

    // Input fields — filled, rounded, iOS style
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.inputBg,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppSpacing.inputRadius),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppSpacing.inputRadius),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppSpacing.inputRadius),
        borderSide: BorderSide(color: accentColor, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppSpacing.inputRadius),
        borderSide: const BorderSide(color: AppColors.error),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppSpacing.inputRadius),
        borderSide: const BorderSide(color: AppColors.error, width: 1.5),
      ),
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      hintStyle: const TextStyle(
          fontFamily: 'Inter', color: AppColors.textTertiary, fontSize: 16),
    ),

    // Elevated buttons — accent color, rounded, 50px height
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: accentColor,
        foregroundColor: Colors.white,
        disabledBackgroundColor: accentColor.withValues(alpha: 0.4),
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.buttonRadius),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        textStyle: const TextStyle(
          fontFamily: 'Inter',
          fontWeight: FontWeight.w600,
          fontSize: 17,
        ),
        minimumSize: const Size(double.infinity, 50),
      ),
    ),

    // Outlined buttons
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: accentColor,
        side: BorderSide(color: accentColor),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.buttonRadius),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        textStyle: const TextStyle(
          fontFamily: 'Inter',
          fontWeight: FontWeight.w600,
          fontSize: 17,
        ),
      ),
    ),

    // Text buttons
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: accentColor),
    ),

    // Dividers
    dividerTheme: const DividerThemeData(
      color: AppColors.border,
      thickness: 0.5,
      space: 0,
    ),

    // Snackbar
    snackBarTheme: SnackBarThemeData(
      backgroundColor: AppColors.textPrimary,
      contentTextStyle: const TextStyle(
          fontFamily: 'Inter', color: Colors.white, fontSize: 14),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      behavior: SnackBarBehavior.floating,
    ),

    // Chips — pill style
    chipTheme: ChipThemeData(
      backgroundColor: AppColors.scaffoldBg,
      selectedColor: accentColor.withValues(alpha: 0.12),
      labelStyle: const TextStyle(
          fontFamily: 'Inter', color: AppColors.textPrimary, fontSize: 14),
      secondaryLabelStyle: TextStyle(
          fontFamily: 'Inter', color: accentColor, fontSize: 14),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
      ),
      side: BorderSide(color: AppColors.border),
    ),

    // Dialogs — glass-aware
    dialogTheme: DialogThemeData(
      backgroundColor: AppColors.cardBg.withValues(alpha: 0.92),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
    ),

    // Bottom sheets — glass-aware
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: AppColors.cardBg.withValues(alpha: 0.88),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
    ),

    // Tab bar
    tabBarTheme: TabBarThemeData(
      labelColor: accentColor,
      unselectedLabelColor: AppColors.textTertiary,
      indicatorColor: accentColor,
      labelStyle: const TextStyle(
          fontFamily: 'Inter', fontSize: 14, fontWeight: FontWeight.w600),
      unselectedLabelStyle: const TextStyle(
          fontFamily: 'Inter', fontSize: 14, fontWeight: FontWeight.w400),
    ),
  );
}

// Keep backward compatibility
ThemeData buildDarkTheme(Color accentColor) => buildTheme(accentColor);

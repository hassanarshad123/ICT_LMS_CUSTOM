import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
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
    appBarTheme: AppBarTheme(
      backgroundColor: AppColors.cardBg,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      surfaceTintColor: Colors.transparent,
      centerTitle: false,
      titleTextStyle: GoogleFonts.inter(
        color: AppColors.textPrimary,
        fontSize: 17,
        fontWeight: FontWeight.w600,
      ),
      iconTheme: const IconThemeData(color: AppColors.textPrimary),
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
    textTheme: GoogleFonts.interTextTheme(base.textTheme).copyWith(
      headlineLarge: GoogleFonts.inter(
          color: AppColors.textPrimary, fontWeight: FontWeight.w700),
      headlineMedium: GoogleFonts.inter(
          color: AppColors.textPrimary, fontWeight: FontWeight.w600),
      titleLarge: GoogleFonts.inter(
          color: AppColors.textPrimary, fontWeight: FontWeight.w600),
      titleMedium: GoogleFonts.inter(color: AppColors.textPrimary),
      bodyLarge: GoogleFonts.inter(color: AppColors.textPrimary),
      bodyMedium: GoogleFonts.inter(color: AppColors.textSecondary),
      bodySmall: GoogleFonts.inter(color: AppColors.textTertiary),
      labelLarge: GoogleFonts.inter(
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
      hintStyle: GoogleFonts.inter(color: AppColors.textTertiary, fontSize: 16),
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
        textStyle: GoogleFonts.inter(
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
        textStyle: GoogleFonts.inter(
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
      contentTextStyle: GoogleFonts.inter(color: Colors.white, fontSize: 14),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      behavior: SnackBarBehavior.floating,
    ),

    // Chips — pill style
    chipTheme: ChipThemeData(
      backgroundColor: AppColors.scaffoldBg,
      selectedColor: accentColor.withValues(alpha: 0.12),
      labelStyle:
          GoogleFonts.inter(color: AppColors.textPrimary, fontSize: 14),
      secondaryLabelStyle:
          GoogleFonts.inter(color: accentColor, fontSize: 14),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
      ),
      side: BorderSide(color: AppColors.border),
    ),

    // Dialogs
    dialogTheme: DialogThemeData(
      backgroundColor: AppColors.cardBg,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
      ),
    ),

    // Bottom sheets
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: AppColors.cardBg,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
    ),

    // Tab bar
    tabBarTheme: TabBarThemeData(
      labelColor: accentColor,
      unselectedLabelColor: AppColors.textTertiary,
      indicatorColor: accentColor,
      labelStyle:
          GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600),
      unselectedLabelStyle:
          GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w400),
    ),
  );
}

// Keep backward compatibility
ThemeData buildDarkTheme(Color accentColor) => buildTheme(accentColor);

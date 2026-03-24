import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../constants/app_colors.dart';

class AppTextStyles {
  AppTextStyles._();

  // Large Title — screen headers (iOS: 34pt bold)
  static TextStyle get largeTitle => GoogleFonts.inter(
        fontSize: 34,
        fontWeight: FontWeight.w700,
        height: 41 / 34,
        letterSpacing: 0.37,
        color: AppColors.textPrimary,
      );

  // Title 1 — prominent headings (iOS: 28pt bold)
  static TextStyle get title1 => GoogleFonts.inter(
        fontSize: 28,
        fontWeight: FontWeight.w700,
        height: 34 / 28,
        letterSpacing: 0.36,
        color: AppColors.textPrimary,
      );

  // Title 2 — section headings (iOS: 22pt bold)
  static TextStyle get title2 => GoogleFonts.inter(
        fontSize: 22,
        fontWeight: FontWeight.w700,
        height: 28 / 22,
        letterSpacing: 0.35,
        color: AppColors.textPrimary,
      );

  // Title 3 — subsection headings (iOS: 20pt semibold)
  static TextStyle get title3 => GoogleFonts.inter(
        fontSize: 20,
        fontWeight: FontWeight.w600,
        height: 25 / 20,
        letterSpacing: 0.38,
        color: AppColors.textPrimary,
      );

  // Headline — emphasized body (iOS: 17pt semibold)
  static TextStyle get headline => GoogleFonts.inter(
        fontSize: 17,
        fontWeight: FontWeight.w600,
        height: 22 / 17,
        letterSpacing: -0.41,
        color: AppColors.textPrimary,
      );

  // Body — default reading text (iOS: 17pt regular)
  static TextStyle get body => GoogleFonts.inter(
        fontSize: 17,
        fontWeight: FontWeight.w400,
        height: 22 / 17,
        letterSpacing: -0.41,
        color: AppColors.textPrimary,
      );

  // Body Medium — slightly emphasized body
  static TextStyle get bodyMedium => GoogleFonts.inter(
        fontSize: 17,
        fontWeight: FontWeight.w500,
        height: 22 / 17,
        letterSpacing: -0.41,
        color: AppColors.textPrimary,
      );

  // Callout — secondary content (iOS: 16pt regular)
  static TextStyle get callout => GoogleFonts.inter(
        fontSize: 16,
        fontWeight: FontWeight.w400,
        height: 21 / 16,
        letterSpacing: -0.32,
        color: AppColors.textSecondary,
      );

  // Subheadline — list subtitles (iOS: 15pt regular)
  static TextStyle get subheadline => GoogleFonts.inter(
        fontSize: 15,
        fontWeight: FontWeight.w400,
        height: 20 / 15,
        letterSpacing: -0.24,
        color: AppColors.textSecondary,
      );

  // Footnote — metadata, timestamps (iOS: 13pt regular)
  static TextStyle get footnote => GoogleFonts.inter(
        fontSize: 13,
        fontWeight: FontWeight.w400,
        height: 18 / 13,
        letterSpacing: -0.08,
        color: AppColors.textSecondary,
      );

  // Caption 1 — small labels (iOS: 12pt regular)
  static TextStyle get caption1 => GoogleFonts.inter(
        fontSize: 12,
        fontWeight: FontWeight.w400,
        height: 16 / 12,
        color: AppColors.textTertiary,
      );

  // Caption 2 — smallest text (iOS: 11pt regular)
  static TextStyle get caption2 => GoogleFonts.inter(
        fontSize: 11,
        fontWeight: FontWeight.w400,
        height: 13 / 11,
        letterSpacing: 0.07,
        color: AppColors.textTertiary,
      );

  // Overline — section labels, uppercase
  static TextStyle get overline => GoogleFonts.inter(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        height: 16 / 12,
        letterSpacing: 0.8,
        color: AppColors.textTertiary,
      );

  // Legacy aliases (keep existing code working)
  static TextStyle get display => largeTitle;
  static TextStyle get heading => title2;
  static TextStyle get title => headline;
  // body, bodyMedium, callout already match
  static TextStyle get caption => caption1;
}

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../constants/app_colors.dart';

/// Design system typography using Inter.
///
/// Clear hierarchy: weight variation > size variation.
class AppTextStyles {
  AppTextStyles._();

  /// 28px bold — page hero titles only
  static TextStyle get display => GoogleFonts.inter(
        fontSize: 28,
        fontWeight: FontWeight.w700,
        height: 34 / 28,
        color: AppColors.textPrimary,
      );

  /// 22px semibold — section headers
  static TextStyle get heading => GoogleFonts.inter(
        fontSize: 22,
        fontWeight: FontWeight.w600,
        height: 28 / 22,
        color: AppColors.textPrimary,
      );

  /// 17px semibold — card titles, list item titles
  static TextStyle get title => GoogleFonts.inter(
        fontSize: 17,
        fontWeight: FontWeight.w600,
        height: 22 / 17,
        color: AppColors.textPrimary,
      );

  /// 15px regular — main content paragraphs
  static TextStyle get body => GoogleFonts.inter(
        fontSize: 15,
        fontWeight: FontWeight.w400,
        height: 22 / 15,
        color: AppColors.textPrimary,
      );

  /// 15px medium — emphasized body text
  static TextStyle get bodyMedium => GoogleFonts.inter(
        fontSize: 15,
        fontWeight: FontWeight.w500,
        height: 22 / 15,
        color: AppColors.textPrimary,
      );

  /// 13px regular — descriptions, secondary info
  static TextStyle get callout => GoogleFonts.inter(
        fontSize: 13,
        fontWeight: FontWeight.w400,
        height: 18 / 13,
        color: AppColors.textSecondary,
      );

  /// 12px regular — timestamps, metadata
  static TextStyle get caption => GoogleFonts.inter(
        fontSize: 12,
        fontWeight: FontWeight.w400,
        height: 16 / 12,
        color: AppColors.textTertiary,
      );

  /// 11px semibold uppercase — labels, section tags
  static TextStyle get overline => GoogleFonts.inter(
        fontSize: 11,
        fontWeight: FontWeight.w600,
        height: 16 / 11,
        letterSpacing: 0.8,
        color: AppColors.textTertiary,
      );
}

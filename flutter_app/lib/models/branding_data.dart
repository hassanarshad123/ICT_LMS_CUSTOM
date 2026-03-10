import 'package:flutter/material.dart';
import '../core/constants/app_colors.dart';

/// Matches BrandingResponse from backend/app/schemas/branding.py.
/// Field names are camelCase -- Dio interceptor converts from snake_case.
class BrandingData {
  final String primaryColor;
  final String accentColor;
  final String backgroundColor;
  final String instituteName;
  final String tagline;
  final String? logoUrl;
  final String? faviconUrl;
  final String? presetTheme;

  const BrandingData({
    this.primaryColor = '#1A1A1A',
    this.accentColor = '#C5D86D',
    this.backgroundColor = '#F0F0F0',
    this.instituteName = 'ICT Institute',
    this.tagline = 'Learning Management System',
    this.logoUrl,
    this.faviconUrl,
    this.presetTheme,
  });

  factory BrandingData.fromJson(Map<String, dynamic> json) {
    return BrandingData(
      primaryColor: json['primaryColor'] as String? ?? '#1A1A1A',
      accentColor: json['accentColor'] as String? ?? '#C5D86D',
      backgroundColor: json['backgroundColor'] as String? ?? '#F0F0F0',
      instituteName: json['instituteName'] as String? ?? 'ICT Institute',
      tagline: json['tagline'] as String? ?? 'Learning Management System',
      logoUrl: json['logoUrl'] as String?,
      faviconUrl: json['faviconUrl'] as String?,
      presetTheme: json['presetTheme'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'primaryColor': primaryColor,
      'accentColor': accentColor,
      'backgroundColor': backgroundColor,
      'instituteName': instituteName,
      'tagline': tagline,
      'logoUrl': logoUrl,
      'faviconUrl': faviconUrl,
      'presetTheme': presetTheme,
    };
  }

  BrandingData copyWith({
    String? primaryColor,
    String? accentColor,
    String? backgroundColor,
    String? instituteName,
    String? tagline,
    String? logoUrl,
    String? faviconUrl,
    String? presetTheme,
  }) {
    return BrandingData(
      primaryColor: primaryColor ?? this.primaryColor,
      accentColor: accentColor ?? this.accentColor,
      backgroundColor: backgroundColor ?? this.backgroundColor,
      instituteName: instituteName ?? this.instituteName,
      tagline: tagline ?? this.tagline,
      logoUrl: logoUrl ?? this.logoUrl,
      faviconUrl: faviconUrl ?? this.faviconUrl,
      presetTheme: presetTheme ?? this.presetTheme,
    );
  }

  /// Parses the accent color hex string into a Flutter Color.
  /// Falls back to AppColors.defaultAccent if parsing fails.
  Color get accentColorValue {
    try {
      final hex = accentColor.replaceFirst('#', '');
      if (hex.length == 6) {
        return Color(int.parse('FF$hex', radix: 16));
      }
      return AppColors.defaultAccent;
    } catch (_) {
      return AppColors.defaultAccent;
    }
  }

  /// Parses the primary color hex string into a Flutter Color.
  Color get primaryColorValue {
    try {
      final hex = primaryColor.replaceFirst('#', '');
      if (hex.length == 6) {
        return Color(int.parse('FF$hex', radix: 16));
      }
      return AppColors.cardBg;
    } catch (_) {
      return AppColors.cardBg;
    }
  }

  @override
  String toString() =>
      'BrandingData(instituteName: $instituteName, accentColor: $accentColor)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is BrandingData &&
          runtimeType == other.runtimeType &&
          primaryColor == other.primaryColor &&
          accentColor == other.accentColor &&
          instituteName == other.instituteName;

  @override
  int get hashCode => Object.hash(primaryColor, accentColor, instituteName);
}

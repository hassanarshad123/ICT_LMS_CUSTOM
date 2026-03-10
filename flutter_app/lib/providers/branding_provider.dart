import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/constants/app_colors.dart';
import '../data/repositories/branding_repository.dart';

/// State for branding data fetched from the backend.
///
/// The accentColor is a parsed Color object (from hex string) for direct use
/// in theme and widgets. Other color fields are kept as hex strings for reference.
class BrandingState {
  final Color accentColor;
  final String? primaryColor;
  final String? instituteName;
  final String? tagline;
  final String? logoUrl;
  final String? faviconUrl;
  final bool isLoading;
  final String? error;

  const BrandingState({
    this.accentColor = AppColors.defaultAccent,
    this.primaryColor,
    this.instituteName,
    this.tagline,
    this.logoUrl,
    this.faviconUrl,
    this.isLoading = false,
    this.error,
  });

  BrandingState copyWith({
    Color? accentColor,
    String? primaryColor,
    String? instituteName,
    String? tagline,
    String? logoUrl,
    String? faviconUrl,
    bool? isLoading,
    String? error,
  }) {
    return BrandingState(
      accentColor: accentColor ?? this.accentColor,
      primaryColor: primaryColor ?? this.primaryColor,
      instituteName: instituteName ?? this.instituteName,
      tagline: tagline ?? this.tagline,
      logoUrl: logoUrl ?? this.logoUrl,
      faviconUrl: faviconUrl ?? this.faviconUrl,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

/// Notifier that manages branding state by fetching from the branding API.
class BrandingNotifier extends StateNotifier<BrandingState> {
  final BrandingRepository _repo;

  BrandingNotifier(this._repo) : super(const BrandingState());

  /// Fetch branding data from the backend.
  ///
  /// Returns true if successful, false if the fetch failed.
  /// On success, parses the accent color hex string to a Flutter Color
  /// and updates all branding fields in state.
  /// On failure, sets the error message while preserving defaults.
  Future<bool> fetchBranding() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final data = await _repo.getBranding();
      state = state.copyWith(
        accentColor: _parseColor(data.accentColor) ?? AppColors.defaultAccent,
        primaryColor: data.primaryColor,
        instituteName: data.instituteName,
        tagline: data.tagline,
        logoUrl: data.logoUrl,
        faviconUrl: data.faviconUrl,
        isLoading: false,
      );
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  /// Parse a hex color string like "#C5D86D" to a Flutter Color.
  ///
  /// Returns null if the string is null, empty, or cannot be parsed.
  /// Handles both "#RRGGBB" and "RRGGBB" formats.
  Color? _parseColor(String? hex) {
    if (hex == null || hex.isEmpty) return null;
    try {
      final clean = hex.replaceAll('#', '');
      if (clean.length != 6) return null;
      return Color(int.parse('FF$clean', radix: 16));
    } catch (_) {
      return null;
    }
  }
}

/// Provider for branding state.
///
/// Depends on [brandingRepositoryProvider] which uses the public Dio client
/// (no auth required for branding endpoint).
final brandingProvider =
    StateNotifierProvider<BrandingNotifier, BrandingState>((ref) {
  final repo = ref.watch(brandingRepositoryProvider);
  return BrandingNotifier(repo);
});

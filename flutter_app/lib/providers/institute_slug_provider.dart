import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../main.dart';
import '../core/constants/storage_keys.dart';

/// Manages the institute slug used for multi-tenancy.
///
/// The slug is persisted in SharedPreferences and sent as
/// the X-Institute-Slug header on every API request via SlugInterceptor.
///
/// On creation, reads the stored slug from SharedPreferences so the app
/// remembers which institute the user belongs to across restarts.
class InstituteSlugNotifier extends StateNotifier<String?> {
  final SharedPreferences _prefs;

  InstituteSlugNotifier(this._prefs)
      : super(_prefs.getString(StorageKeys.instituteSlug));

  /// Persist the slug and update state.
  Future<void> setSlug(String slug) async {
    final trimmed = slug.trim().toLowerCase();
    await _prefs.setString(StorageKeys.instituteSlug, trimmed);
    state = trimmed;
  }

  /// Write slug to SharedPreferences only, without updating provider state.
  /// Used during validation — state is committed only after branding confirms.
  Future<void> persistSlug(String slug) async {
    final trimmed = slug.trim().toLowerCase();
    await _prefs.setString(StorageKeys.instituteSlug, trimmed);
  }

  /// Commit the persisted slug to provider state (triggers router redirect).
  void commitSlug() {
    state = _prefs.getString(StorageKeys.instituteSlug);
  }

  /// Remove the slug from storage and clear state.
  Future<void> clearSlug() async {
    await _prefs.remove(StorageKeys.instituteSlug);
    state = null;
  }
}

/// Provider for the institute slug.
///
/// Returns null when no slug has been set (user needs to go through onboarding).
/// Returns the slug string when set (user has selected an institute).
final instituteSlugProvider =
    StateNotifierProvider<InstituteSlugNotifier, String?>((ref) {
  final prefs = ref.watch(sharedPreferencesProvider);
  return InstituteSlugNotifier(prefs);
});

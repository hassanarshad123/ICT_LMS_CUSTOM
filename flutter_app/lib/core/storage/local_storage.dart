import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../constants/storage_keys.dart';

class LocalStorageService {
  final SharedPreferences _prefs;

  LocalStorageService(this._prefs);

  // Slug
  String? getSlug() => _prefs.getString(StorageKeys.instituteSlug);
  Future<void> setSlug(String slug) =>
      _prefs.setString(StorageKeys.instituteSlug, slug);

  // User JSON
  Map<String, dynamic>? getUserJson() {
    final json = _prefs.getString(StorageKeys.userJson);
    if (json == null) return null;
    return jsonDecode(json) as Map<String, dynamic>;
  }

  Future<void> setUserJson(Map<String, dynamic> user) =>
      _prefs.setString(StorageKeys.userJson, jsonEncode(user));

  // Branding JSON
  Map<String, dynamic>? getBrandingJson() {
    final json = _prefs.getString(StorageKeys.brandingJson);
    if (json == null) return null;
    return jsonDecode(json) as Map<String, dynamic>;
  }

  Future<void> setBrandingJson(Map<String, dynamic> branding) =>
      _prefs.setString(StorageKeys.brandingJson, jsonEncode(branding));

  // Clear user data (keep slug so user stays in the same institute)
  Future<void> clear() async {
    await _prefs.remove(StorageKeys.userJson);
    await _prefs.remove(StorageKeys.brandingJson);
  }

  Future<void> clearAll() => _prefs.clear();
}

import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../constants/storage_keys.dart';

class SlugInterceptor extends Interceptor {
  final SharedPreferences _prefs;
  String? _cachedSlug;

  SlugInterceptor(this._prefs) {
    _cachedSlug = _prefs.getString(StorageKeys.instituteSlug);
  }

  void updateSlug(String? slug) {
    _cachedSlug = slug;
  }

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final slug = _cachedSlug ?? _prefs.getString(StorageKeys.instituteSlug);
    if (slug != null && slug.isNotEmpty) {
      options.headers['X-Institute-Slug'] = slug;
    }
    handler.next(options);
  }
}

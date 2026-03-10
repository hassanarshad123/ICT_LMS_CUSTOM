import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/api_constants.dart';
import '../../core/network/api_client.dart';
import '../../models/branding_data.dart';
import '../../models/institute_item.dart';

/// Repository for branding-related API calls.
///
/// Uses the PUBLIC Dio instance (no auth interceptor) because the branding
/// endpoint is public and called before the user is authenticated.
///
/// The SlugInterceptor on the public Dio handles the X-Institute-Slug header.
/// The CaseConvertInterceptor handles snake_case <-> camelCase conversion.
///
/// Endpoint: backend/app/routers/branding.py -> GET /branding
class BrandingRepository {
  final Dio _dio;

  BrandingRepository(this._dio);

  /// GET /branding
  ///
  /// Public endpoint -- returns branding settings for the institute
  /// identified by the X-Institute-Slug header.
  ///
  /// Returns: BrandingData { primaryColor, accentColor, backgroundColor,
  ///   instituteName, tagline, logoUrl, faviconUrl, presetTheme }
  Future<BrandingData> getBranding() async {
    final response = await _dio.get(ApiConstants.branding);
    return BrandingData.fromJson(response.data as Map<String, dynamic>);
  }

  /// GET /branding/institutes
  ///
  /// Public endpoint -- returns list of active institutes [{name, slug}].
  Future<List<InstituteItem>> getInstitutes() async {
    final response = await _dio.get(ApiConstants.publicInstitutes);
    final list = response.data as List<dynamic>;
    return list
        .map((e) => InstituteItem.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}

/// Provider for [BrandingRepository] using the public Dio client.
final brandingRepositoryProvider = Provider<BrandingRepository>((ref) {
  final dio = ref.watch(publicDioProvider);
  return BrandingRepository(dio);
});

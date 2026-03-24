import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/api_constants.dart';
import '../../core/network/api_client.dart';
import '../../models/announcement_out.dart';
import '../../models/paginated_response.dart';

class AnnouncementRepository {
  final Dio _dio;

  AnnouncementRepository(this._dio);

  /// GET /announcements with optional filters.
  ///
  /// Students see announcements scoped to their institute, batches, and courses.
  /// Supports filtering by scope (institute/batch/course), batchId, and courseId.
  Future<PaginatedResponse<AnnouncementOut>> listAnnouncements({
    int page = 1,
    int perPage = 20,
    String? scope,
    String? batchId,
    String? courseId,
  }) async {
    final queryParams = <String, dynamic>{
      'page': page,
      'per_page': perPage,
    };
    if (scope != null) queryParams['scope'] = scope;
    if (batchId != null) queryParams['batch_id'] = batchId;
    if (courseId != null) queryParams['course_id'] = courseId;

    final response = await _dio.get(
      ApiConstants.announcements,
      queryParameters: queryParams,
    );

    return PaginatedResponse.fromJson(
      response.data as Map<String, dynamic>,
      (json) => AnnouncementOut.fromJson(json),
    );
  }
}

final announcementRepositoryProvider = Provider<AnnouncementRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return AnnouncementRepository(dio);
});

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/api_constants.dart';
import '../../core/network/api_client.dart';
import '../../models/zoom_class_out.dart';
import '../../models/recording_list_out.dart';
import '../../models/recording_signed_url.dart';

class ZoomRepository {
  final Dio _dio;

  ZoomRepository(this._dio);

  /// GET /zoom/classes with optional filters.
  ///
  /// Students only see classes for batches they are enrolled in (backend filters).
  Future<Map<String, dynamic>> listClasses({
    int page = 1,
    int perPage = 20,
    String? batchId,
    String? status,
  }) async {
    final queryParams = <String, dynamic>{
      'page': page,
      'per_page': perPage,
    };
    if (batchId != null) queryParams['batch_id'] = batchId;
    if (status != null) queryParams['status'] = status;

    final response = await _dio.get(
      ApiConstants.zoomClasses,
      queryParameters: queryParams,
    );

    final data = response.data as Map<String, dynamic>;
    final items = (data['data'] as List<dynamic>?)
            ?.map((e) => ZoomClassOut.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];

    return {
      'data': items,
      'total': data['total'] as int? ?? 0,
      'page': data['page'] as int? ?? 1,
      'perPage': data['perPage'] as int? ?? perPage,
      'totalPages': data['totalPages'] as int? ?? 0,
    };
  }

  /// GET /zoom/classes/{classId}/recordings
  ///
  /// Returns recordings for a specific class.
  Future<List<Map<String, dynamic>>> getClassRecordings(String classId) async {
    final response = await _dio.get(
      '${ApiConstants.zoomClasses}/$classId/recordings',
    );
    final data = response.data as List<dynamic>;
    return data.cast<Map<String, dynamic>>();
  }

  /// GET /zoom/recordings (paginated global list).
  Future<Map<String, dynamic>> listRecordings({
    int page = 1,
    int perPage = 20,
  }) async {
    final response = await _dio.get(
      ApiConstants.zoomRecordings,
      queryParameters: {
        'page': page,
        'per_page': perPage,
      },
    );

    final data = response.data as Map<String, dynamic>;
    final items = (data['data'] as List<dynamic>?)
            ?.map(
                (e) => RecordingListOut.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];

    return {
      'data': items,
      'total': data['total'] as int? ?? 0,
      'page': data['page'] as int? ?? 1,
      'perPage': data['perPage'] as int? ?? perPage,
      'totalPages': data['totalPages'] as int? ?? 0,
    };
  }

  /// POST /zoom/recordings/{recordingId}/signed-url
  Future<RecordingSignedUrl> getRecordingSignedUrl(
      String recordingId) async {
    final response = await _dio
        .post('${ApiConstants.zoomRecordings}/$recordingId/signed-url');
    return RecordingSignedUrl.fromJson(
        response.data as Map<String, dynamic>);
  }
}

final zoomRepositoryProvider = Provider<ZoomRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return ZoomRepository(dio);
});

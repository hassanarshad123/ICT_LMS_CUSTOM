import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/core/constants/api_constants.dart';
import 'package:ict_lms_student/core/network/api_client.dart';
import 'package:ict_lms_student/models/application_out.dart';
import 'package:ict_lms_student/models/job_out.dart';

class JobRepository {
  final Dio _dio;

  JobRepository(this._dio);

  /// GET /jobs
  Future<Map<String, dynamic>> listJobs({
    int page = 1,
    int perPage = 20,
    String? type,
    String? search,
  }) async {
    final queryParams = <String, dynamic>{
      'page': page,
      'per_page': perPage,
    };
    if (type != null) queryParams['type'] = type;
    if (search != null && search.isNotEmpty) queryParams['search'] = search;

    final response = await _dio.get(
      ApiConstants.jobs,
      queryParameters: queryParams,
    );

    final data = response.data as Map<String, dynamic>;
    final items = (data['data'] as List<dynamic>?)
            ?.map((e) => JobOut.fromJson(e as Map<String, dynamic>))
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

  /// GET /jobs/{jobId}
  Future<JobOut> getJob(String jobId) async {
    final response = await _dio.get('${ApiConstants.jobs}/$jobId');
    return JobOut.fromJson(response.data as Map<String, dynamic>);
  }

  /// POST /jobs/{jobId}/apply
  Future<Map<String, dynamic>> applyToJob({
    required String jobId,
    String? coverLetter,
  }) async {
    final response = await _dio.post(
      '${ApiConstants.jobs}/$jobId/apply',
      data: {
        'coverLetter': coverLetter,
      },
    );
    return response.data as Map<String, dynamic>;
  }

  /// GET /jobs/my-applications
  Future<List<ApplicationOut>> getMyApplications() async {
    final response = await _dio.get(ApiConstants.myApplications);
    final data = response.data as List<dynamic>;
    return data
        .map((e) => ApplicationOut.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}

final jobRepositoryProvider = Provider<JobRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return JobRepository(dio);
});

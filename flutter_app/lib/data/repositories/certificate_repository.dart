import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/core/constants/api_constants.dart';
import 'package:ict_lms_student/core/network/api_client.dart';
import 'package:ict_lms_student/models/certificate_out.dart';
import 'package:ict_lms_student/models/student_dashboard_course.dart';

class CertificateRepository {
  final Dio _dio;

  CertificateRepository(this._dio);

  /// GET /certificates/my-dashboard
  Future<List<StudentDashboardCourse>> getStudentDashboard() async {
    final response = await _dio.get(ApiConstants.certificateDashboard);
    final data = response.data as List<dynamic>;
    return data
        .map((e) =>
            StudentDashboardCourse.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// POST /certificates/request
  Future<CertificateOut> requestCertificate({
    required String batchId,
    required String courseId,
    required String certificateName,
  }) async {
    final response = await _dio.post(
      ApiConstants.certificateRequest,
      data: {
        'batchId': batchId,
        'courseId': courseId,
        'certificateName': certificateName,
      },
    );
    return CertificateOut.fromJson(response.data as Map<String, dynamic>);
  }

  /// GET /certificates
  Future<Map<String, dynamic>> listCertificates({
    int page = 1,
    int perPage = 20,
    String? status,
  }) async {
    final queryParams = <String, dynamic>{
      'page': page,
      'per_page': perPage,
    };
    if (status != null) queryParams['status'] = status;

    final response = await _dio.get(
      ApiConstants.certificates,
      queryParameters: queryParams,
    );

    final data = response.data as Map<String, dynamic>;
    final items = (data['data'] as List<dynamic>?)
            ?.map(
                (e) => CertificateOut.fromJson(e as Map<String, dynamic>))
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

  /// GET /certificates/{certUuid}
  Future<CertificateOut> getCertificate(String certUuid) async {
    final response =
        await _dio.get('${ApiConstants.certificates}/$certUuid');
    return CertificateOut.fromJson(response.data as Map<String, dynamic>);
  }

  /// GET /certificates/{certUuid}/download
  Future<String> downloadCertificate(String certUuid) async {
    final response =
        await _dio.get('${ApiConstants.certificates}/$certUuid/download');
    final data = response.data as Map<String, dynamic>;
    return data['downloadUrl'] as String? ?? '';
  }
}

final certificateRepositoryProvider = Provider<CertificateRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return CertificateRepository(dio);
});

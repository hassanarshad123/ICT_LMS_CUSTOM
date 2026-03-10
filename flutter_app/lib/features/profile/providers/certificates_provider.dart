import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/data/repositories/certificate_repository.dart';
import 'package:ict_lms_student/models/certificate_out.dart';
import 'package:ict_lms_student/models/student_dashboard_course.dart';

/// Fetches the student's certificate dashboard (all enrolled courses with cert status).
final certificatesDashboardProvider =
    FutureProvider.autoDispose<List<StudentDashboardCourse>>((ref) async {
  final repo = ref.watch(certificateRepositoryProvider);
  return repo.getStudentDashboard();
});

/// Provides mutation methods for certificate actions.
class CertificateActionsNotifier extends StateNotifier<AsyncValue<void>> {
  final CertificateRepository _repo;

  CertificateActionsNotifier(this._repo) : super(const AsyncValue.data(null));

  /// Request a certificate for a course.
  Future<CertificateOut> requestCertificate({
    required String batchId,
    required String courseId,
    required String certificateName,
  }) async {
    state = const AsyncValue.loading();
    try {
      final cert = await _repo.requestCertificate(
        batchId: batchId,
        courseId: courseId,
        certificateName: certificateName,
      );
      state = const AsyncValue.data(null);
      return cert;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      rethrow;
    }
  }

  /// Get the download URL for a certificate.
  Future<String> downloadCertificate(String certUuid) async {
    state = const AsyncValue.loading();
    try {
      final url = await _repo.downloadCertificate(certUuid);
      state = const AsyncValue.data(null);
      return url;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      rethrow;
    }
  }
}

final certificateActionsProvider =
    StateNotifierProvider.autoDispose<CertificateActionsNotifier, AsyncValue<void>>(
        (ref) {
  final repo = ref.watch(certificateRepositoryProvider);
  return CertificateActionsNotifier(repo);
});

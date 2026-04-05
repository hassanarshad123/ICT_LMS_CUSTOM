import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:path_provider/path_provider.dart';
import 'package:ict_lms_student/core/constants/app_animations.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/utils/responsive.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/features/profile/providers/certificates_provider.dart';
import 'package:ict_lms_student/features/profile/widgets/certificate_card.dart';
import 'package:ict_lms_student/models/student_dashboard_course.dart';
import 'package:ict_lms_student/providers/auth_provider.dart';
import 'package:ict_lms_student/shared/widgets/shimmer_loading.dart';

class CertificatesScreen extends ConsumerWidget {
  const CertificatesScreen({super.key});

  Future<void> _requestCertificate(
    BuildContext context,
    WidgetRef ref,
    StudentDashboardCourse course,
  ) async {
    final user = ref.read(authProvider).user;
    final certificateName = user?.name ?? '';

    if (certificateName.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('User name not available'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    try {
      final actionsNotifier = ref.read(certificateActionsProvider.notifier);
      await actionsNotifier.requestCertificate(
        batchId: course.batchId,
        courseId: course.courseId,
        certificateName: certificateName,
      );

      if (context.mounted) {
        AppAnimations.hapticMedium();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Certificate requested successfully'),
            backgroundColor: AppColors.success,
          ),
        );
        // Refresh the dashboard.
        ref.invalidate(certificatesDashboardProvider);
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e.toString().replaceFirst('Exception: ', ''),
            ),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  Future<void> _downloadCertificate(
    BuildContext context,
    WidgetRef ref,
    StudentDashboardCourse course,
  ) async {
    if (course.certificateId == null) return;

    try {
      final actionsNotifier = ref.read(certificateActionsProvider.notifier);
      final downloadUrl =
          await actionsNotifier.downloadCertificate(course.certificateId!);

      if (downloadUrl.isEmpty) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Download URL not available'),
              backgroundColor: AppColors.error,
            ),
          );
        }
        return;
      }

      // Download PDF to temp directory.
      final tempDir = await getTemporaryDirectory();
      final fileName =
          'certificate_${course.courseTitle.replaceAll(RegExp(r'[^\w]'), '_')}.pdf';
      final filePath = '${tempDir.path}/$fileName';

      final dio = Dio();
      await dio.download(downloadUrl, filePath);

      if (context.mounted) {
        context.push('/pdf-viewer', extra: {
          'filePath': filePath,
          'fileName': 'Certificate - ${course.courseTitle}',
        });
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Download failed: ${e.toString().replaceFirst("Exception: ", "")}',
            ),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncData = ref.watch(certificatesDashboardProvider);

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        title: Text('Certificates', style: AppTextStyles.headline),
        backgroundColor: AppColors.cardBg,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
      ),
      body: asyncData.when(
        loading: () => const ShimmerList(itemCount: 4, itemHeight: 120),
        error: (error, _) => Center(
          child: Padding(
            padding: EdgeInsets.all(Responsive.screenPadding(context)),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline,
                    color: AppColors.error, size: 48),
                const SizedBox(height: AppSpacing.space16),
                Text(
                  error.toString().replaceFirst('Exception: ', ''),
                  style: AppTextStyles.subheadline.copyWith(
                    color: AppColors.textSecondary,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.space16),
                TextButton(
                  onPressed: () =>
                      ref.invalidate(certificatesDashboardProvider),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (courses) {
          if (courses.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.workspace_premium_outlined,
                      color: AppColors.textTertiary, size: 64),
                  const SizedBox(height: AppSpacing.space16),
                  Text(
                    'No courses enrolled',
                    style: AppTextStyles.headline.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.space8),
                  Text(
                    'Certificates will appear here once you\nenroll in a course',
                    style: AppTextStyles.footnote.copyWith(
                      color: AppColors.textTertiary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            color: Theme.of(context).colorScheme.primary,
            onRefresh: () async {
              AppAnimations.hapticLight();
              ref.invalidate(certificatesDashboardProvider);
            },
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.screenH,
                AppSpacing.screenH,
                AppSpacing.screenH,
                80,
              ),
              itemCount: courses.length,
              itemBuilder: (context, index) {
                final course = courses[index];
                return CertificateCard(
                  course: course,
                  onRequestTap: () =>
                      _requestCertificate(context, ref, course),
                  onDownloadTap: course.hasCertificate
                      ? () => _downloadCertificate(context, ref, course)
                      : null,
                );
              },
            ),
          );
        },
      ),
    );
  }
}

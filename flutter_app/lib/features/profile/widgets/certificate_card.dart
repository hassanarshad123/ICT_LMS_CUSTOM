import 'package:flutter/material.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_shadows.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/models/student_dashboard_course.dart';
import 'package:ict_lms_student/shared/widgets/status_badge.dart';

class CertificateCard extends StatelessWidget {
  final StudentDashboardCourse course;
  final VoidCallback? onRequestTap;
  final VoidCallback? onDownloadTap;

  const CertificateCard({
    super.key,
    required this.course,
    this.onRequestTap,
    this.onDownloadTap,
  });

  @override
  Widget build(BuildContext context) {
    final accentColor = Theme.of(context).colorScheme.primary;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
        boxShadow: AppShadows.sm,
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.cardPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Course title + status.
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        course.courseTitle,
                        style: AppTextStyles.headline,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: AppSpacing.space4),
                      Text(
                        course.batchName,
                        style: AppTextStyles.footnote.copyWith(
                          color: AppColors.textTertiary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                StatusBadge(status: course.status),
              ],
            ),
            const SizedBox(height: AppSpacing.space12),
            // Progress bar.
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Completion: ${course.completionPercentage}%',
                      style: AppTextStyles.caption1.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                    Text(
                      'Threshold: ${course.threshold}%',
                      style: AppTextStyles.caption1.copyWith(
                        color: AppColors.textTertiary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: course.completionPercentage / 100,
                    minHeight: 6,
                    backgroundColor: AppColors.scaffoldBg,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      course.completionPercentage >= course.threshold
                          ? AppColors.success
                          : accentColor,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.space12),
            // Action button based on status.
            if (course.hasCertificate && onDownloadTap != null)
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: onDownloadTap,
                  icon: const Icon(Icons.download_rounded, size: 18),
                  label: const Text('Download Certificate'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.success,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.circular(AppSpacing.buttonRadius),
                    ),
                  ),
                ),
              )
            else if (course.isEligible &&
                course.status != 'pending' &&
                course.status != 'approved' &&
                onRequestTap != null)
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: onRequestTap,
                  icon:
                      const Icon(Icons.workspace_premium_outlined, size: 18),
                  label: const Text('Request Certificate'),
                  style: FilledButton.styleFrom(
                    backgroundColor: accentColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.circular(AppSpacing.buttonRadius),
                    ),
                  ),
                ),
              )
            else if (course.status == 'pending')
              Center(
                child: Text(
                  'Certificate request pending approval',
                  style: AppTextStyles.footnote.copyWith(
                    color: AppColors.warning,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              )
            else if (!course.isEligible)
              Center(
                child: Text(
                  'Complete ${course.threshold}% to request certificate',
                  style: AppTextStyles.footnote.copyWith(
                    color: AppColors.textTertiary,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

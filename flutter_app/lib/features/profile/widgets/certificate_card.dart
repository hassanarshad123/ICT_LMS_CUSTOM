import 'package:flutter/material.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
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

    return Card(
      color: AppColors.cardBg,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
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
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w600,
                          fontSize: 16,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        course.batchName,
                        style: const TextStyle(
                          color: AppColors.textTertiary,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                StatusBadge(status: course.status),
              ],
            ),
            const SizedBox(height: 12),
            // Progress bar.
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Completion: ${course.completionPercentage}%',
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                    Text(
                      'Threshold: ${course.threshold}%',
                      style: const TextStyle(
                        color: AppColors.textTertiary,
                        fontSize: 12,
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
                    backgroundColor: AppColors.surfaceBg,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      course.completionPercentage >= course.threshold
                          ? AppColors.success
                          : accentColor,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
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
                      borderRadius: BorderRadius.circular(12),
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
                    foregroundColor: AppColors.scaffoldBg,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              )
            else if (course.status == 'pending')
              const Center(
                child: Text(
                  'Certificate request pending approval',
                  style: TextStyle(
                    color: AppColors.warning,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              )
            else if (!course.isEligible)
              Center(
                child: Text(
                  'Complete ${course.threshold}% to request certificate',
                  style: const TextStyle(
                    color: AppColors.textTertiary,
                    fontSize: 13,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

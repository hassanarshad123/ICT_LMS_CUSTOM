import 'package:flutter/material.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_shadows.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/models/application_out.dart';
import 'package:ict_lms_student/shared/widgets/status_badge.dart';
import 'package:intl/intl.dart';

class ApplicationCard extends StatelessWidget {
  final ApplicationOut application;
  final String? jobTitle;
  final String? companyName;

  const ApplicationCard({
    super.key,
    required this.application,
    this.jobTitle,
    this.companyName,
  });

  @override
  Widget build(BuildContext context) {
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
            // Job title (if provided) + status.
            Row(
              children: [
                if (jobTitle != null)
                  Expanded(
                    child: Text(
                      jobTitle!,
                      style: AppTextStyles.headline.copyWith(fontSize: 15),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  )
                else
                  Expanded(
                    child: Text(
                      'Application #${application.id.substring(0, 8)}',
                      style: AppTextStyles.headline.copyWith(fontSize: 15),
                    ),
                  ),
                const SizedBox(width: 12),
                StatusBadge(status: application.status),
              ],
            ),
            if (companyName != null) ...[
              const SizedBox(height: AppSpacing.space4),
              Row(
                children: [
                  const Icon(Icons.business,
                      size: 14, color: AppColors.textTertiary),
                  const SizedBox(width: 6),
                  Text(
                    companyName!,
                    style: AppTextStyles.footnote.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: AppSpacing.space8),
            // Applied date.
            if (application.createdAt != null)
              Row(
                children: [
                  const Icon(Icons.calendar_today,
                      size: 12, color: AppColors.textTertiary),
                  const SizedBox(width: 6),
                  Text(
                    'Applied ${DateFormat('MMM d, yyyy').format(application.createdAt!)}',
                    style: AppTextStyles.caption1.copyWith(
                      color: AppColors.textTertiary,
                    ),
                  ),
                ],
              ),
            // Cover letter preview.
            if (application.coverLetter != null &&
                application.coverLetter!.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.space8),
              Text(
                application.coverLetter!,
                style: AppTextStyles.footnote.copyWith(
                  color: AppColors.textSecondary,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

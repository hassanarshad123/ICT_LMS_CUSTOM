import 'package:flutter/material.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
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
            // Job title (if provided) + status.
            Row(
              children: [
                if (jobTitle != null)
                  Expanded(
                    child: Text(
                      jobTitle!,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  )
                else
                  Expanded(
                    child: Text(
                      'Application #${application.id.substring(0, 8)}',
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
                  ),
                const SizedBox(width: 12),
                StatusBadge(status: application.status),
              ],
            ),
            if (companyName != null) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.business,
                      size: 14, color: AppColors.textTertiary),
                  const SizedBox(width: 6),
                  Text(
                    companyName!,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 8),
            // Applied date.
            if (application.createdAt != null)
              Row(
                children: [
                  const Icon(Icons.calendar_today,
                      size: 12, color: AppColors.textTertiary),
                  const SizedBox(width: 6),
                  Text(
                    'Applied ${DateFormat('MMM d, yyyy').format(application.createdAt!)}',
                    style: const TextStyle(
                      color: AppColors.textTertiary,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            // Cover letter preview.
            if (application.coverLetter != null &&
                application.coverLetter!.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                application.coverLetter!,
                style: const TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 13,
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

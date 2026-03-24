import 'package:flutter/material.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_shadows.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/models/job_out.dart';
import 'package:intl/intl.dart';

class JobCard extends StatelessWidget {
  final JobOut job;
  final VoidCallback? onTap;

  const JobCard({
    super.key,
    required this.job,
    this.onTap,
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
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
          splashColor: accentColor.withValues(alpha: 0.08),
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.cardPadding),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Title.
                Text(
                  job.title,
                  style: AppTextStyles.headline,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: AppSpacing.space8),
                // Company + location.
                Row(
                  children: [
                    Icon(Icons.business,
                        size: 14, color: AppColors.textTertiary),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        job.company,
                        style: AppTextStyles.footnote.copyWith(
                          color: AppColors.textSecondary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (job.location != null &&
                        job.location!.isNotEmpty) ...[
                      const SizedBox(width: 12),
                      Icon(Icons.location_on_outlined,
                          size: 14, color: AppColors.textTertiary),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          job.location!,
                          style: AppTextStyles.caption1.copyWith(
                            color: AppColors.textTertiary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 10),
                // Type + salary + deadline row.
                Wrap(
                  spacing: 10,
                  runSpacing: 6,
                  children: [
                    _InfoChip(
                      icon: Icons.work_outline,
                      label: job.typeLabel,
                      color: accentColor,
                    ),
                    if (job.salary != null && job.salary!.isNotEmpty)
                      _InfoChip(
                        icon: Icons.payments_outlined,
                        label: job.salary!,
                        color: AppColors.success,
                      ),
                    if (job.deadline != null)
                      _InfoChip(
                        icon: Icons.event,
                        label: job.isExpired
                            ? 'Expired'
                            : 'Due ${DateFormat('MMM d').format(job.deadline!)}',
                        color: job.isExpired
                            ? AppColors.error
                            : AppColors.textTertiary,
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;

  const _InfoChip({
    required this.icon,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: AppTextStyles.caption2.copyWith(
              color: color,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

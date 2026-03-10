import 'package:flutter/material.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
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

    return Card(
      color: AppColors.cardBg,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        splashColor: accentColor.withValues(alpha: 0.1),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Title.
              Text(
                job.title,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w600,
                  fontSize: 16,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 8),
              // Company + location.
              Row(
                children: [
                  const Icon(Icons.business,
                      size: 14, color: AppColors.textTertiary),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      job.company,
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (job.location != null && job.location!.isNotEmpty) ...[
                    const SizedBox(width: 12),
                    const Icon(Icons.location_on_outlined,
                        size: 14, color: AppColors.textTertiary),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        job.location!,
                        style: const TextStyle(
                          color: AppColors.textTertiary,
                          fontSize: 12,
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
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

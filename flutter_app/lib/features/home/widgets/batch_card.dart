import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_shadows.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/responsive.dart';
import '../../../models/batch_out.dart';
import '../../../shared/widgets/status_badge.dart';
import '../../../shared/widgets/tap_scale.dart';
import '../../../shared/extensions/date_extensions.dart';

/// Horizontal scrolling card showing batch info.
///
/// Displays batch name, status badge, date range, student and course counts.
/// Tapping navigates to courses filtered by this batch.
class BatchCard extends StatelessWidget {
  final BatchOut batch;

  const BatchCard({super.key, required this.batch});

  int? get _daysLeft {
    final end = batch.effectiveEndDate ?? batch.endDate;
    if (end == null) return null;
    return end.difference(DateTime.now()).inDays;
  }

  @override
  Widget build(BuildContext context) {
    return TapScale(
      onTap: () {
        // Navigate to courses tab filtered by this batch
        context.go('/courses');
      },
      child: Container(
        width: Responsive.isCompact(context) ? 240 : 280,
        padding: const EdgeInsets.all(AppSpacing.cardPadding),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
          border: Border.all(color: AppColors.border, width: 1),
          boxShadow: AppShadows.sm,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // Title and status
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  batch.name,
                  style: AppTextStyles.headline,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: AppSpacing.space8),
                Row(
                  children: [
                    StatusBadge(status: batch.status),
                    if (batch.accessExpired == true) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.error.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          'Expired',
                          style: TextStyle(
                            color: AppColors.error,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ] else if (_daysLeft != null && _daysLeft! <= 7) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.amber.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          '${_daysLeft}d left',
                          style: TextStyle(
                            color: Colors.amber.shade800,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),

            // Date range and counts
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (batch.startDate != null && batch.endDate != null) ...[
                  Text(
                    batch.startDate!.toDateRange(batch.endDate!),
                    style: AppTextStyles.caption1,
                  ),
                  const SizedBox(height: AppSpacing.space4),
                ],
                Row(
                  children: [
                    const Icon(
                      Icons.people_alt_outlined,
                      size: 14,
                      color: AppColors.textTertiary,
                    ),
                    const SizedBox(width: AppSpacing.space4),
                    Text(
                      '${batch.studentCount}',
                      style: AppTextStyles.caption1,
                    ),
                    const SizedBox(width: AppSpacing.space12),
                    const Icon(
                      Icons.book_outlined,
                      size: 14,
                      color: AppColors.textTertiary,
                    ),
                    const SizedBox(width: AppSpacing.space4),
                    Text(
                      '${batch.courseCount} courses',
                      style: AppTextStyles.caption1,
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

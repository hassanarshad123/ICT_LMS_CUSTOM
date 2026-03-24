import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_shadows.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/batch_out.dart';
import '../../../shared/widgets/status_badge.dart';
import '../../../shared/extensions/date_extensions.dart';

/// Horizontal scrolling card showing batch info.
///
/// Displays batch name, status badge, date range, student and course counts.
/// Tapping navigates to courses filtered by this batch.
class BatchCard extends StatelessWidget {
  final BatchOut batch;

  const BatchCard({super.key, required this.batch});

  @override
  Widget build(BuildContext context) {
    final accentColor = Theme.of(context).colorScheme.primary;

    return GestureDetector(
      onTap: () {
        // Navigate to courses tab filtered by this batch
        context.go('/courses');
      },
      child: Container(
        width: 240,
        padding: const EdgeInsets.all(AppSpacing.cardPadding),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
          boxShadow: AppShadows.sm,
          border: Border(
            left: BorderSide(
              color: accentColor,
              width: 4,
            ),
          ),
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
                StatusBadge(status: batch.status),
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

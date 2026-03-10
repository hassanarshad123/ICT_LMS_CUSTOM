import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
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
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(16),
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
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 8),
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
                    style: const TextStyle(
                      color: AppColors.textTertiary,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 6),
                ],
                Row(
                  children: [
                    Icon(
                      Icons.people_alt_outlined,
                      size: 14,
                      color: AppColors.textTertiary,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '${batch.studentCount}',
                      style: const TextStyle(
                        color: AppColors.textTertiary,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Icon(
                      Icons.book_outlined,
                      size: 14,
                      color: AppColors.textTertiary,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '${batch.courseCount} courses',
                      style: const TextStyle(
                        color: AppColors.textTertiary,
                        fontSize: 12,
                      ),
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

import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_shadows.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';

/// Small card displaying an icon, count, and label.
///
/// Used in the stat cards row on the home dashboard to show
/// batches count, courses count, and upcoming classes count.
class StatCard extends StatelessWidget {
  final IconData icon;
  final int count;
  final String label;

  const StatCard({
    super.key,
    required this.icon,
    required this.count,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    final accentColor = Theme.of(context).colorScheme.primary;

    return Container(
      width: 110,
      padding: const EdgeInsets.symmetric(
        vertical: AppSpacing.space16,
        horizontal: AppSpacing.space12,
      ),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
        boxShadow: AppShadows.sm,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: accentColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              icon,
              color: accentColor,
              size: 20,
            ),
          ),
          const SizedBox(height: AppSpacing.space8),
          Text(
            count.toString(),
            style: AppTextStyles.title2,
          ),
          const SizedBox(height: AppSpacing.space2),
          Text(
            label,
            style: AppTextStyles.caption1,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

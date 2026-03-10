import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';

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
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            color: accentColor,
            size: 24,
          ),
          const SizedBox(height: 8),
          Text(
            count.toString(),
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 22,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 12,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

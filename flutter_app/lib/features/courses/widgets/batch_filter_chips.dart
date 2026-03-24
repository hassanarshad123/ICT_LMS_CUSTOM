import 'package:flutter/material.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';

class BatchFilterChips extends StatelessWidget {
  final List<String> batchIds;
  final List<String> batchNames;
  final String? selectedBatchId;
  final ValueChanged<String?> onChanged;

  const BatchFilterChips({
    super.key,
    required this.batchIds,
    required this.batchNames,
    required this.selectedBatchId,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final accentColor = Theme.of(context).colorScheme.primary;

    return SizedBox(
      height: 52,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.screenH,
          vertical: AppSpacing.space8,
        ),
        children: [
          // "All" chip.
          Padding(
            padding: const EdgeInsets.only(right: AppSpacing.space8),
            child: FilterChip(
              label: const Text('All'),
              selected: selectedBatchId == null,
              onSelected: (_) => onChanged(null),
              selectedColor: accentColor.withValues(alpha: 0.15),
              checkmarkColor: accentColor,
              labelStyle: TextStyle(
                color: selectedBatchId == null
                    ? accentColor
                    : AppColors.textSecondary,
                fontWeight: selectedBatchId == null
                    ? FontWeight.w600
                    : FontWeight.normal,
                fontSize: 14,
              ),
              backgroundColor: AppColors.cardBg,
              side: BorderSide(
                color: selectedBatchId == null
                    ? accentColor.withValues(alpha: 0.3)
                    : AppColors.border,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
            ),
          ),
          // One chip per batch.
          for (int i = 0; i < batchIds.length; i++)
            Padding(
              padding: const EdgeInsets.only(right: AppSpacing.space8),
              child: FilterChip(
                label: Text(
                  i < batchNames.length ? batchNames[i] : 'Batch ${i + 1}',
                ),
                selected: selectedBatchId == batchIds[i],
                onSelected: (_) => onChanged(batchIds[i]),
                selectedColor: accentColor.withValues(alpha: 0.15),
                checkmarkColor: accentColor,
                labelStyle: TextStyle(
                  color: selectedBatchId == batchIds[i]
                      ? accentColor
                      : AppColors.textSecondary,
                  fontWeight: selectedBatchId == batchIds[i]
                      ? FontWeight.w600
                      : FontWeight.normal,
                  fontSize: 14,
                ),
                backgroundColor: AppColors.cardBg,
                side: BorderSide(
                  color: selectedBatchId == batchIds[i]
                      ? accentColor.withValues(alpha: 0.3)
                      : AppColors.border,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

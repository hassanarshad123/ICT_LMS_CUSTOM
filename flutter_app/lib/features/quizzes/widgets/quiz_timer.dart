import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';

class QuizTimer extends StatelessWidget {
  final int remainingSeconds;
  final bool isWarning;

  const QuizTimer({
    super.key,
    required this.remainingSeconds,
    this.isWarning = false,
  });

  @override
  Widget build(BuildContext context) {
    if (remainingSeconds <= 0) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.timer_outlined, size: 18, color: AppColors.error),
          const SizedBox(width: 4),
          Text(
            "Time's up!",
            style: AppTextStyles.subheadline.copyWith(
              color: AppColors.error,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      );
    }

    final minutes = remainingSeconds ~/ 60;
    final seconds = remainingSeconds % 60;
    final formatted =
        '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';

    final color = isWarning
        ? (remainingSeconds <= 10 ? AppColors.error : AppColors.warning)
        : AppColors.textPrimary;

    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: color.withValues(alpha: 0.15),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.timer_outlined, size: 18, color: color),
              const SizedBox(width: 4),
              Text(
                formatted,
                style: AppTextStyles.subheadline.copyWith(
                  color: color,
                  fontWeight: FontWeight.w600,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

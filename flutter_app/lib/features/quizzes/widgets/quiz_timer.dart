import 'package:flutter/material.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';

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
          Icon(Icons.timer_outlined, size: 18, color: AppColors.error),
          const SizedBox(width: 4),
          Text(
            "Time's up!",
            style: TextStyle(
              color: AppColors.error,
              fontSize: 14,
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

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.timer_outlined, size: 18, color: color),
        const SizedBox(width: 4),
        Text(
          formatted,
          style: TextStyle(
            color: color,
            fontSize: 14,
            fontWeight: FontWeight.w600,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
      ],
    );
  }
}

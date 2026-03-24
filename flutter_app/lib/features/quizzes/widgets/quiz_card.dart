import 'package:flutter/material.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_shadows.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/models/quiz_out.dart';

class QuizCard extends StatelessWidget {
  final QuizOut quiz;
  final VoidCallback onTap;

  const QuizCard({super.key, required this.quiz, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final accent = Theme.of(context).colorScheme.primary;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.cardPadding),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
          boxShadow: AppShadows.sm,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'Quiz',
                    style: AppTextStyles.caption1.copyWith(
                      color: accent,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const Spacer(),
                Icon(Icons.chevron_right,
                    color: AppColors.textTertiary, size: 20),
              ],
            ),
            const SizedBox(height: AppSpacing.space12),
            Text(
              quiz.title,
              style: AppTextStyles.headline,
            ),
            if (quiz.description != null && quiz.description!.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                quiz.description!,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.footnote,
              ),
            ],
            const SizedBox(height: AppSpacing.space12),
            Wrap(
              spacing: 16,
              runSpacing: 8,
              children: [
                _metaChip(Icons.quiz_outlined, '${quiz.questionCount} questions'),
                _metaChip(
                  Icons.timer_outlined,
                  quiz.timeLimitMinutes != null
                      ? '${quiz.timeLimitMinutes} min'
                      : 'No time limit',
                ),
                _metaChip(
                    Icons.check_circle_outline, 'Pass: ${quiz.passPercentage}%'),
                _metaChip(Icons.replay, '${quiz.maxAttempts} attempts'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _metaChip(IconData icon, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: AppColors.textTertiary),
        const SizedBox(width: 4),
        Text(text, style: AppTextStyles.caption1),
      ],
    );
  }
}

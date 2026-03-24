import 'package:flutter/material.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_shadows.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/models/quiz_question_out.dart';
import 'package:ict_lms_student/models/quiz_attempt_out.dart';

class QuestionReviewCard extends StatelessWidget {
  final QuizQuestionOut question;
  final QuizAnswerOut answer;
  final int questionNumber;

  const QuestionReviewCard({
    super.key,
    required this.question,
    required this.answer,
    required this.questionNumber,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
        boxShadow: AppShadows.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: question number + status icon + points
          Row(
            children: [
              Text(
                'Q$questionNumber',
                style: AppTextStyles.footnote.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textTertiary,
                ),
              ),
              const SizedBox(width: AppSpacing.space8),
              _statusIcon(),
              const Spacer(),
              _pointsBadge(),
            ],
          ),
          const SizedBox(height: AppSpacing.space12),
          // Question text
          Text(
            question.questionText,
            style: AppTextStyles.subheadline.copyWith(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: AppSpacing.space12),
          // Student's answer
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.space12),
            decoration: BoxDecoration(
              color: AppColors.inputBg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Your answer',
                  style: AppTextStyles.caption2.copyWith(
                    fontWeight: FontWeight.w600,
                    color: AppColors.textTertiary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _displayAnswer(),
                  style: AppTextStyles.subheadline.copyWith(
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
          // Feedback
          if (answer.feedback != null && answer.feedback!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.space12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.space12),
              decoration: BoxDecoration(
                color: AppColors.info.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.comment_outlined,
                          size: 14, color: AppColors.info),
                      const SizedBox(width: 4),
                      Text(
                        'Feedback',
                        style: AppTextStyles.caption2.copyWith(
                          color: AppColors.info,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    answer.feedback!,
                    style: AppTextStyles.footnote.copyWith(
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _statusIcon() {
    if (answer.isCorrect == true) {
      return const Icon(Icons.check_circle, color: AppColors.success, size: 20);
    } else if (answer.isCorrect == false) {
      return const Icon(Icons.cancel, color: AppColors.error, size: 20);
    }
    return const Icon(Icons.hourglass_empty,
        color: AppColors.textTertiary, size: 20);
  }

  Widget _pointsBadge() {
    final awarded = answer.pointsAwarded;
    final total = question.points;
    final text = awarded != null ? '$awarded/$total pts' : '$total pts';

    return Text(
      text,
      style: AppTextStyles.caption1.copyWith(
        fontWeight: FontWeight.w600,
        color: AppColors.textSecondary,
      ),
    );
  }

  String _displayAnswer() {
    final text = answer.answerText;
    if (text == null || text.isEmpty) return 'No answer provided';

    // For MCQ, show the option label + value if available
    if (question.questionType == 'mcq' && question.options != null) {
      final optionValue = question.options![text];
      if (optionValue != null) {
        return '${text.toUpperCase()}: $optionValue';
      }
    }

    // For true/false, capitalize
    if (question.questionType == 'true_false') {
      return text[0].toUpperCase() + text.substring(1);
    }

    return text;
  }
}

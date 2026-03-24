import 'package:flutter/material.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_shadows.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/models/quiz_question_out.dart';

class QuestionSwipeCard extends StatelessWidget {
  final QuizQuestionOut question;
  final int questionNumber;
  final int totalQuestions;
  final String? selectedAnswer;
  final ValueChanged<String> onAnswerChanged;

  const QuestionSwipeCard({
    super.key,
    required this.question,
    required this.questionNumber,
    required this.totalQuestions,
    this.selectedAnswer,
    required this.onAnswerChanged,
  });

  @override
  Widget build(BuildContext context) {
    final accent = Theme.of(context).colorScheme.primary;

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.screenH),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.space20),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(AppSpacing.space20),
          boxShadow: AppShadows.sm,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header: Question number + points
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    'Q$questionNumber',
                    style: AppTextStyles.caption1.copyWith(
                      color: accent,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.space8),
                Text(
                  'of $totalQuestions',
                  style: AppTextStyles.footnote,
                ),
                const Spacer(),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.inputBg,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '${question.points} pts',
                    style: AppTextStyles.caption1.copyWith(
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.space20),
            // Question text
            Text(
              question.questionText,
              style: AppTextStyles.body.copyWith(
                fontWeight: FontWeight.w500,
                height: 1.4,
              ),
            ),
            const SizedBox(height: AppSpacing.space24),
            // Answer area
            Expanded(
              child: _buildAnswerArea(context, accent),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAnswerArea(BuildContext context, Color accent) {
    switch (question.questionType) {
      case 'mcq':
        return _buildMcqOptions(accent);
      case 'true_false':
        return _buildTrueFalseButtons(accent);
      case 'short_answer':
        return _buildShortAnswer();
      default:
        return Text(
          'Unsupported question type',
          style: AppTextStyles.subheadline,
        );
    }
  }

  Widget _buildMcqOptions(Color accent) {
    final options = question.options ?? {};
    final sortedKeys = options.keys.toList()..sort();

    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: sortedKeys.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final key = sortedKeys[index];
        final value = options[key]?.toString() ?? '';
        final isSelected = selectedAnswer == key;

        return GestureDetector(
          onTap: () => onAnswerChanged(key),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: isSelected
                  ? accent.withValues(alpha: 0.08)
                  : AppColors.inputBg,
              borderRadius: BorderRadius.circular(AppSpacing.inputRadius),
              border: Border.all(
                color: isSelected ? accent : Colors.transparent,
                width: 1.5,
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: isSelected ? accent : AppColors.cardBg,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isSelected ? accent : AppColors.border,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    key.toUpperCase(),
                    style: AppTextStyles.footnote.copyWith(
                      color:
                          isSelected ? Colors.white : AppColors.textSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.space12),
                Expanded(
                  child: Text(
                    value,
                    style: AppTextStyles.subheadline.copyWith(
                      color: isSelected
                          ? AppColors.textPrimary
                          : AppColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildTrueFalseButtons(Color accent) {
    return Column(
      children: [
        _trueFalseButton('True', 'true', accent),
        const SizedBox(height: AppSpacing.space12),
        _trueFalseButton('False', 'false', accent),
      ],
    );
  }

  Widget _trueFalseButton(String label, String value, Color accent) {
    final isSelected = selectedAnswer == value;

    return GestureDetector(
      onTap: () => onAnswerChanged(value),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 18),
        decoration: BoxDecoration(
          color: isSelected
              ? accent.withValues(alpha: 0.08)
              : AppColors.inputBg,
          borderRadius: BorderRadius.circular(AppSpacing.inputRadius),
          border: Border.all(
            color: isSelected ? accent : Colors.transparent,
            width: 1.5,
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: AppTextStyles.headline.copyWith(
            color: isSelected ? accent : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }

  Widget _buildShortAnswer() {
    return TextField(
      onChanged: onAnswerChanged,
      maxLines: 5,
      controller: selectedAnswer != null
          ? (TextEditingController(text: selectedAnswer)
            ..selection = TextSelection.collapsed(
                offset: selectedAnswer?.length ?? 0))
          : null,
      style: AppTextStyles.body,
      decoration: InputDecoration(
        hintText: 'Type your answer here...',
        hintStyle: AppTextStyles.body.copyWith(color: AppColors.textTertiary),
        filled: true,
        fillColor: AppColors.inputBg,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.inputRadius),
          borderSide: BorderSide.none,
        ),
      ),
    );
  }
}

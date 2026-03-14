import 'package:flutter/material.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
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
      padding: const EdgeInsets.all(16),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.surfaceBg),
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
                    color: accent.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    'Q$questionNumber',
                    style: TextStyle(
                      color: accent,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  'of $totalQuestions',
                  style: const TextStyle(
                    color: AppColors.textTertiary,
                    fontSize: 13,
                  ),
                ),
                const Spacer(),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceBg,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '${question.points} pts',
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            // Question text
            Text(
              question.questionText,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 17,
                fontWeight: FontWeight.w500,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 24),
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
        return const Text(
          'Unsupported question type',
          style: TextStyle(color: AppColors.textSecondary),
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
                  ? accent.withValues(alpha: 0.1)
                  : AppColors.surfaceBg,
              borderRadius: BorderRadius.circular(12),
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
                    color: isSelected
                        ? accent
                        : AppColors.cardBg,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isSelected ? accent : AppColors.textTertiary,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    key.toUpperCase(),
                    style: TextStyle(
                      color: isSelected ? Colors.white : AppColors.textSecondary,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    value,
                    style: TextStyle(
                      color: isSelected
                          ? AppColors.textPrimary
                          : AppColors.textSecondary,
                      fontSize: 15,
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
        const SizedBox(height: 12),
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
              ? accent.withValues(alpha: 0.1)
              : AppColors.surfaceBg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? accent : Colors.transparent,
            width: 1.5,
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? accent : AppColors.textSecondary,
            fontSize: 16,
            fontWeight: FontWeight.w600,
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
      style: const TextStyle(color: AppColors.textPrimary),
      decoration: InputDecoration(
        hintText: 'Type your answer here...',
        hintStyle: const TextStyle(color: AppColors.textTertiary),
        filled: true,
        fillColor: AppColors.surfaceBg,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
      ),
    );
  }
}

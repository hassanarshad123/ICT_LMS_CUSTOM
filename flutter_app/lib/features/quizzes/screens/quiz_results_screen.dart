import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/features/quizzes/providers/quiz_result_provider.dart';
import 'package:ict_lms_student/features/quizzes/widgets/score_gauge.dart';
import 'package:ict_lms_student/features/quizzes/widgets/question_review_card.dart';

class QuizResultsScreen extends ConsumerWidget {
  final String quizId;
  final String attemptId;

  const QuizResultsScreen({
    super.key,
    required this.quizId,
    required this.attemptId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final params = (attemptId: attemptId, quizId: quizId);
    final asyncData = ref.watch(quizResultProvider(params));

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        title: Text('Quiz Results', style: AppTextStyles.headline),
        backgroundColor: AppColors.cardBg,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
      ),
      body: asyncData.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: AppSpacing.space24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline,
                    color: AppColors.error, size: 48),
                const SizedBox(height: AppSpacing.space16),
                Text(error.toString(), style: AppTextStyles.subheadline,
                    textAlign: TextAlign.center),
                const SizedBox(height: AppSpacing.space16),
                TextButton(
                  onPressed: () =>
                      ref.invalidate(quizResultProvider(params)),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (data) {
          final attempt = data.attempt;
          final questions = data.questions;
          final answerMap = {
            for (final a in attempt.answers) a.questionId: a
          };

          return ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.screenH,
              AppSpacing.space16,
              AppSpacing.screenH,
              80,
            ),
            children: [
              // Score gauge
              Center(
                child: ScoreGauge(
                  percentage: attempt.percentage,
                  passed: attempt.passed,
                ),
              ),
              const SizedBox(height: AppSpacing.space16),
              // Score text
              if (attempt.score != null)
                Center(
                  child: Text(
                    '${attempt.score} / ${attempt.maxScore} points',
                    style: AppTextStyles.callout,
                  ),
                ),
              // Pending review badge
              if (attempt.status == 'submitted') ...[
                const SizedBox(height: AppSpacing.space12),
                Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppColors.warning.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.hourglass_empty,
                            size: 16, color: AppColors.warning),
                        const SizedBox(width: 6),
                        Text(
                          'Pending Review',
                          style: AppTextStyles.footnote.copyWith(
                            color: AppColors.warning,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.space24),
              // Question review cards
              if (questions.isNotEmpty) ...[
                Text('Question Review', style: AppTextStyles.headline),
                const SizedBox(height: AppSpacing.space12),
                ...questions.asMap().entries.map((entry) {
                  final index = entry.key;
                  final question = entry.value;
                  final answer = answerMap[question.id];
                  if (answer == null) return const SizedBox.shrink();
                  return Padding(
                    padding:
                        const EdgeInsets.only(bottom: AppSpacing.space12),
                    child: QuestionReviewCard(
                      question: question,
                      answer: answer,
                      questionNumber: index + 1,
                    ),
                  );
                }),
              ],
            ],
          );
        },
      ),
    );
  }
}

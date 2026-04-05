import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/core/constants/app_animations.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/utils/responsive.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/features/quizzes/providers/quiz_result_provider.dart';
import 'package:ict_lms_student/features/quizzes/widgets/score_gauge.dart';
import 'package:ict_lms_student/features/quizzes/widgets/question_review_card.dart';
import 'package:ict_lms_student/shared/widgets/celebration_overlay.dart';
import 'package:ict_lms_student/shared/widgets/shimmer_loading.dart';

class QuizResultsScreen extends ConsumerStatefulWidget {
  final String quizId;
  final String attemptId;

  const QuizResultsScreen({
    super.key,
    required this.quizId,
    required this.attemptId,
  });

  @override
  ConsumerState<QuizResultsScreen> createState() => _QuizResultsScreenState();
}

class _QuizResultsScreenState extends ConsumerState<QuizResultsScreen> {
  bool _celebrationTriggered = false;

  void _triggerCelebration(bool passed) {
    if (_celebrationTriggered) return;
    _celebrationTriggered = true;

    // Fire haptic after the gauge animation completes (~1200ms).
    Future.delayed(const Duration(milliseconds: 1200), () {
      if (!mounted) return;
      if (passed) {
        AppAnimations.hapticHeavy();
      } else {
        AppAnimations.hapticMedium();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final params = (attemptId: widget.attemptId, quizId: widget.quizId);
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
        loading: () => const Padding(
          padding: EdgeInsets.all(AppSpacing.screenH),
          child: Column(
            children: [
              ShimmerCard(height: 160),
              SizedBox(height: 16),
              ShimmerCard(height: 40),
              SizedBox(height: 24),
              ShimmerCard(height: 120),
              SizedBox(height: 12),
              ShimmerCard(height: 120),
            ],
          ),
        ),
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
          final passed = attempt.passed == true;

          // Trigger celebration haptics on first data load.
          _triggerCelebration(passed);

          return CelebrationOverlay(
            show: passed,
            delay: const Duration(milliseconds: 1200),
            child: ListView(
              padding: EdgeInsets.fromLTRB(
                Responsive.screenPadding(context),
                AppSpacing.space16,
                Responsive.screenPadding(context),
                80,
              ),
              children: [
                // Score gauge.
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
                // Passed/Failed status with pulse on pass.
                if (attempt.percentage != null) ...[
                  const SizedBox(height: AppSpacing.space8),
                  Center(
                    child: Text(
                      passed ? 'Passed' : 'Failed',
                      style: AppTextStyles.headline.copyWith(
                        color: passed ? AppColors.success : AppColors.error,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
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
            ),
          );
        },
      ),
    );
  }
}

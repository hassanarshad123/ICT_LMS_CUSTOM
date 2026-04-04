import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:ict_lms_student/core/constants/app_animations.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_shadows.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/utils/responsive.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/data/repositories/quiz_repository.dart';
import 'package:ict_lms_student/models/quiz_out.dart';
import 'package:ict_lms_student/models/quiz_attempt_out.dart';
import 'package:ict_lms_student/shared/widgets/shimmer_loading.dart';

/// Provider that fetches quiz detail + past attempts.
final _quizStartDataProvider = FutureProvider.autoDispose
    .family<_QuizStartData, ({String courseId, String quizId})>(
  (ref, params) async {
    final repo = ref.watch(quizRepositoryProvider);
    final results = await Future.wait([
      repo.listQuizzes(courseId: params.courseId),
      repo.getMyAttempts(courseId: params.courseId),
    ]);
    final quizzes = results[0] as List<QuizOut>;
    final attempts = results[1] as List<QuizAttemptOut>;
    final quiz = quizzes.firstWhere((q) => q.id == params.quizId);
    final quizAttempts = attempts.where((a) => a.quizId == params.quizId).toList();
    return _QuizStartData(quiz: quiz, attempts: quizAttempts);
  },
);

class _QuizStartData {
  final QuizOut quiz;
  final List<QuizAttemptOut> attempts;
  const _QuizStartData({required this.quiz, required this.attempts});
}

class QuizStartScreen extends ConsumerWidget {
  final String courseId;
  final String quizId;

  const QuizStartScreen({
    super.key,
    required this.courseId,
    required this.quizId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final params = (courseId: courseId, quizId: quizId);
    final asyncData = ref.watch(_quizStartDataProvider(params));
    final accent = Theme.of(context).colorScheme.primary;

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        title: Text('Quiz', style: AppTextStyles.headline),
        backgroundColor: AppColors.cardBg,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
      ),
      body: asyncData.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(AppSpacing.screenH),
          child: Column(
            children: [
              ShimmerCard(height: 200),
              SizedBox(height: 16),
              ShimmerCard(height: 64),
              SizedBox(height: 12),
              ShimmerCard(height: 64),
              SizedBox(height: 12),
              ShimmerCard(height: 64),
            ],
          ),
        ),
        error: (error, _) {
          final isExpired = error.toString().toLowerCase().contains('expired');
          return Center(
            child: Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: AppSpacing.space24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    isExpired ? Icons.lock_outline : Icons.error_outline,
                    color: isExpired ? Colors.amber.shade700 : AppColors.error,
                    size: 48,
                  ),
                  const SizedBox(height: AppSpacing.space16),
                  Text(
                    isExpired
                        ? 'Your batch access has expired. You cannot start new quiz attempts.'
                        : error.toString(),
                    style: AppTextStyles.subheadline,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: AppSpacing.space16),
                  TextButton(
                    onPressed: () => isExpired
                        ? Navigator.of(context).pop()
                        : ref.invalidate(_quizStartDataProvider(params)),
                    child: Text(isExpired ? 'Go Back' : 'Retry'),
                  ),
                ],
              ),
            ),
          );
        },
        data: (data) {
          final quiz = data.quiz;
          final attempts = data.attempts;
          final completedAttempts =
              attempts.where((a) => a.status != 'in_progress').length;
          final canStart = completedAttempts < quiz.maxAttempts;

          return Column(
            children: [
              Expanded(
                child: ListView(
                  padding: EdgeInsets.fromLTRB(
                    Responsive.screenPadding(context),
                    AppSpacing.space16,
                    Responsive.screenPadding(context),
                    80,
                  ),
                  children: [
                    // Quiz info card
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.space20),
                      decoration: BoxDecoration(
                        color: AppColors.cardBg,
                        borderRadius:
                            BorderRadius.circular(AppSpacing.cardRadius),
                        boxShadow: AppShadows.sm,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Hero(
                            tag: 'quiz-${quiz.id}',
                            child: Material(
                              type: MaterialType.transparency,
                              child: Text(quiz.title, style: AppTextStyles.title3),
                            ),
                          ),
                          if (quiz.description != null &&
                              quiz.description!.isNotEmpty) ...[
                            const SizedBox(height: AppSpacing.space8),
                            Text(
                              quiz.description!,
                              style: AppTextStyles.subheadline,
                            ),
                          ],
                          const SizedBox(height: AppSpacing.space20),
                          _infoRow(Icons.quiz_outlined,
                              '${quiz.questionCount} questions'),
                          const SizedBox(height: AppSpacing.space12),
                          _infoRow(
                            Icons.timer_outlined,
                            quiz.timeLimitMinutes != null
                                ? '${quiz.timeLimitMinutes} minutes'
                                : 'No time limit',
                          ),
                          const SizedBox(height: AppSpacing.space12),
                          _infoRow(Icons.check_circle_outline,
                              'Pass: ${quiz.passPercentage}%'),
                          const SizedBox(height: AppSpacing.space12),
                          _infoRow(Icons.replay,
                              'Max attempts: ${quiz.maxAttempts}'),
                          const SizedBox(height: AppSpacing.space12),
                          _infoRow(Icons.donut_large,
                              'Used: $completedAttempts / ${quiz.maxAttempts}'),
                        ],
                      ),
                    ),
                    // Previous attempts
                    if (attempts.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.space24),
                      Text('Previous Attempts', style: AppTextStyles.headline),
                      const SizedBox(height: AppSpacing.space12),
                      ...attempts.map((attempt) => Padding(
                            padding:
                                const EdgeInsets.only(bottom: AppSpacing.space8),
                            child: _attemptTile(context, attempt, accent),
                          )),
                    ],
                  ],
                ),
              ),
              // Start button
              Container(
                color: AppColors.cardBg,
                padding: EdgeInsets.all(Responsive.screenPadding(context)),
                child: SafeArea(
                  top: false,
                  child: SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: canStart
                          ? () {
                              AppAnimations.hapticMedium();
                              context.push(
                                '/courses/$courseId/quiz/$quizId/take',
                              );
                            }
                          : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: accent,
                        foregroundColor: Colors.white,
                        disabledBackgroundColor: AppColors.inputBg,
                        disabledForegroundColor: AppColors.textTertiary,
                        shape: RoundedRectangleBorder(
                          borderRadius:
                              BorderRadius.circular(AppSpacing.buttonRadius),
                        ),
                        elevation: 0,
                      ),
                      child: Text(
                        canStart ? 'Start Quiz' : 'Max Attempts Reached',
                        style: AppTextStyles.headline.copyWith(
                          color: canStart
                              ? Colors.white
                              : AppColors.textTertiary,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _infoRow(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 18, color: AppColors.textTertiary),
        const SizedBox(width: 10),
        Text(text, style: AppTextStyles.subheadline),
      ],
    );
  }

  Widget _attemptTile(
      BuildContext context, QuizAttemptOut attempt, Color accent) {
    final statusColor = switch (attempt.status) {
      'graded' =>
        attempt.passed == true ? AppColors.success : AppColors.error,
      'submitted' => AppColors.warning,
      _ => AppColors.textTertiary,
    };

    return GestureDetector(
      onTap: attempt.status != 'in_progress'
          ? () => context.push(
                '/courses/$courseId/quiz/$quizId/results/${attempt.id}',
              )
          : null,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.cardPadding),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
          boxShadow: AppShadows.sm,
        ),
        child: Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: statusColor,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: AppSpacing.space12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    attempt.status == 'graded'
                        ? '${attempt.percentage}% — ${attempt.passed == true ? "Passed" : "Failed"}'
                        : attempt.status == 'submitted'
                            ? 'Submitted — Pending Review'
                            : 'In Progress',
                    style: AppTextStyles.subheadline.copyWith(
                      color: AppColors.textPrimary,
                    ),
                  ),
                  if (attempt.score != null)
                    Text(
                      '${attempt.score}/${attempt.maxScore} points',
                      style: AppTextStyles.caption1,
                    ),
                ],
              ),
            ),
            if (attempt.status != 'in_progress')
              const Icon(
                Icons.chevron_right,
                color: AppColors.textTertiary,
                size: 20,
              ),
          ],
        ),
      ),
    );
  }
}

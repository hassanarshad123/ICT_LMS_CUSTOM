import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/data/repositories/quiz_repository.dart';
import 'package:ict_lms_student/models/quiz_out.dart';
import 'package:ict_lms_student/models/quiz_attempt_out.dart';

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
      appBar: AppBar(title: const Text('Quiz')),
      body: asyncData.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, color: AppColors.error, size: 48),
              const SizedBox(height: 16),
              Text(error.toString(),
                  style: const TextStyle(color: AppColors.textSecondary)),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () => ref.invalidate(_quizStartDataProvider(params)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
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
                  padding: const EdgeInsets.all(16),
                  children: [
                    // Quiz info card
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: AppColors.cardBg,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.surfaceBg),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            quiz.title,
                            style: const TextStyle(
                              color: AppColors.textPrimary,
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          if (quiz.description != null &&
                              quiz.description!.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            Text(
                              quiz.description!,
                              style: const TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 14,
                              ),
                            ),
                          ],
                          const SizedBox(height: 20),
                          _infoRow(Icons.quiz_outlined,
                              '${quiz.questionCount} questions'),
                          const SizedBox(height: 10),
                          _infoRow(
                            Icons.timer_outlined,
                            quiz.timeLimitMinutes != null
                                ? '${quiz.timeLimitMinutes} minutes'
                                : 'No time limit',
                          ),
                          const SizedBox(height: 10),
                          _infoRow(Icons.check_circle_outline,
                              'Pass: ${quiz.passPercentage}%'),
                          const SizedBox(height: 10),
                          _infoRow(Icons.replay,
                              'Max attempts: ${quiz.maxAttempts}'),
                          const SizedBox(height: 10),
                          _infoRow(Icons.donut_large,
                              'Used: $completedAttempts / ${quiz.maxAttempts}'),
                        ],
                      ),
                    ),
                    // Previous attempts
                    if (attempts.isNotEmpty) ...[
                      const SizedBox(height: 24),
                      const Text(
                        'Previous Attempts',
                        style: TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 12),
                      ...attempts.map((attempt) => Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: _attemptTile(context, attempt, accent),
                          )),
                    ],
                  ],
                ),
              ),
              // Start button
              Padding(
                padding: const EdgeInsets.all(16),
                child: SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    onPressed: canStart
                        ? () => context.push(
                              '/courses/$courseId/quiz/$quizId/take',
                            )
                        : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: accent,
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: AppColors.surfaceBg,
                      disabledForegroundColor: AppColors.textTertiary,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: Text(
                      canStart
                          ? 'Start Quiz'
                          : 'Max Attempts Reached',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
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
        Text(
          text,
          style: const TextStyle(
            color: AppColors.textSecondary,
            fontSize: 14,
          ),
        ),
      ],
    );
  }

  Widget _attemptTile(
      BuildContext context, QuizAttemptOut attempt, Color accent) {
    final statusColor = switch (attempt.status) {
      'graded' => attempt.passed == true ? AppColors.success : AppColors.error,
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
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.surfaceBg),
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
            const SizedBox(width: 12),
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
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 14,
                    ),
                  ),
                  if (attempt.score != null)
                    Text(
                      '${attempt.score}/${attempt.maxScore} points',
                      style: const TextStyle(
                        color: AppColors.textTertiary,
                        fontSize: 12,
                      ),
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

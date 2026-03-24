import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/features/quizzes/providers/quiz_list_provider.dart';
import 'package:ict_lms_student/features/quizzes/widgets/quiz_card.dart';

class QuizListTab extends ConsumerWidget {
  final String courseId;

  const QuizListTab({super.key, required this.courseId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncQuizzes = ref.watch(quizListProvider(courseId));

    return asyncQuizzes.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline,
                  color: AppColors.error, size: 48),
              const SizedBox(height: AppSpacing.space16),
              Text(
                error.toString(),
                style: AppTextStyles.subheadline,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.space16),
              TextButton(
                onPressed: () => ref.invalidate(quizListProvider(courseId)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
      data: (quizzes) {
        if (quizzes.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.quiz_outlined,
                    color: AppColors.textTertiary, size: 64),
                const SizedBox(height: AppSpacing.space16),
                Text(
                  'No quizzes available',
                  style: AppTextStyles.callout,
                ),
              ],
            ),
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.screenH,
            AppSpacing.space16,
            AppSpacing.screenH,
            80,
          ),
          itemCount: quizzes.length,
          itemBuilder: (context, index) {
            final quiz = quizzes[index];
            return Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.space12),
              child: QuizCard(
                quiz: quiz,
                onTap: () => context.push(
                  '/courses/$courseId/quiz/${quiz.id}',
                ),
              ),
            );
          },
        );
      },
    );
  }
}

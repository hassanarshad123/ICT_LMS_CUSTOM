import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
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
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, color: AppColors.error, size: 48),
            const SizedBox(height: 16),
            Text(
              error.toString(),
              style: const TextStyle(color: AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: () => ref.invalidate(quizListProvider(courseId)),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (quizzes) {
        if (quizzes.isEmpty) {
          return const Center(
            child: Text(
              'No quizzes available',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: quizzes.length,
          itemBuilder: (context, index) {
            final quiz = quizzes[index];
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
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

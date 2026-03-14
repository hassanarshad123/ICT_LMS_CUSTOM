import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/features/quizzes/providers/quiz_attempt_provider.dart';
import 'package:ict_lms_student/features/quizzes/providers/quiz_list_provider.dart';
import 'package:ict_lms_student/features/quizzes/widgets/question_swipe_card.dart';
import 'package:ict_lms_student/features/quizzes/widgets/quiz_timer.dart';

class QuizTakingScreen extends ConsumerStatefulWidget {
  final String courseId;
  final String quizId;

  const QuizTakingScreen({
    super.key,
    required this.courseId,
    required this.quizId,
  });

  @override
  ConsumerState<QuizTakingScreen> createState() => _QuizTakingScreenState();
}

class _QuizTakingScreenState extends ConsumerState<QuizTakingScreen> {
  final PageController _pageController = PageController();
  bool _initialized = false;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _initQuiz() {
    if (_initialized) return;
    _initialized = true;

    final quizzes = ref.read(quizListProvider(widget.courseId));
    quizzes.whenData((list) {
      final quiz = list.firstWhere((q) => q.id == widget.quizId);
      ref.read(quizTakingProvider.notifier).loadQuiz(quiz);
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(quizTakingProvider);
    final notifier = ref.read(quizTakingProvider.notifier);
    final accent = Theme.of(context).colorScheme.primary;

    // Initialize on first build
    if (!_initialized && state.quiz == null && !state.isLoading) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _initQuiz());
    }

    // Auto-navigate to results after submission
    ref.listen(quizTakingProvider, (prev, next) {
      if (next.isSubmitted && next.result != null && prev?.isSubmitted != true) {
        context.go(
          '/courses/${widget.courseId}/quiz/${widget.quizId}/results/${next.result!.id}',
        );
      }
    });

    // Grace period dialog
    if (state.isGracePeriod && !state.isSubmitted) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _showGracePeriodDialog(context, state, notifier);
      });
    }

    if (state.isLoading || state.quiz == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Quiz')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (state.error != null && state.questions.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Quiz')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, color: AppColors.error, size: 48),
              const SizedBox(height: 16),
              Text(state.error!,
                  style: const TextStyle(color: AppColors.textSecondary)),
            ],
          ),
        ),
      );
    }

    return PopScope(
      canPop: state.answers.isEmpty,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _showExitConfirmation(context);
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(state.quiz!.title),
          actions: [
            if (state.remainingSeconds != null)
              Padding(
                padding: const EdgeInsets.only(right: 16),
                child: QuizTimer(
                  remainingSeconds: state.remainingSeconds!,
                  isWarning: state.isTimerWarning,
                ),
              ),
          ],
        ),
        body: Column(
          children: [
            // Questions PageView
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                itemCount: state.questions.length,
                onPageChanged: (page) => notifier.goToPage(page),
                itemBuilder: (context, index) {
                  final question = state.questions[index];
                  return QuestionSwipeCard(
                    question: question,
                    questionNumber: index + 1,
                    totalQuestions: state.questions.length,
                    selectedAnswer: state.answers[question.id],
                    onAnswerChanged: (answer) =>
                        notifier.setAnswer(question.id, answer),
                  );
                },
              ),
            ),
            // Bottom bar: dot indicators + progress + submit
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: const BoxDecoration(
                color: AppColors.cardBg,
                border: Border(
                  top: BorderSide(color: AppColors.surfaceBg),
                ),
              ),
              child: SafeArea(
                top: false,
                child: Row(
                  children: [
                    // Dot indicators
                    Expanded(
                      child: SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: List.generate(
                            state.questions.length,
                            (i) {
                              final isAnswered =
                                  state.answers.containsKey(state.questions[i].id);
                              final isCurrent = i == state.currentPage;
                              return GestureDetector(
                                onTap: () => _pageController.animateToPage(
                                  i,
                                  duration: const Duration(milliseconds: 300),
                                  curve: Curves.easeInOut,
                                ),
                                child: Container(
                                  width: isCurrent ? 12 : 8,
                                  height: isCurrent ? 12 : 8,
                                  margin:
                                      const EdgeInsets.symmetric(horizontal: 3),
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: isAnswered
                                        ? accent
                                        : isCurrent
                                            ? AppColors.textSecondary
                                            : AppColors.surfaceBg,
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Progress text
                    Text(
                      '${notifier.answeredCount}/${state.questions.length}',
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Submit button
                    ElevatedButton(
                      onPressed: state.isSubmitting
                          ? null
                          : () => _confirmSubmit(context, state, notifier),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: accent,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 20, vertical: 10),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      child: state.isSubmitting
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white),
                            )
                          : const Text(
                              'Submit',
                              style: TextStyle(fontWeight: FontWeight.w600),
                            ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmSubmit(
    BuildContext context,
    QuizTakingState state,
    QuizTakingNotifier notifier,
  ) {
    final unanswered = state.questions.length - notifier.answeredCount;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.cardBg,
        title: const Text('Submit Quiz?',
            style: TextStyle(color: AppColors.textPrimary)),
        content: Text(
          unanswered > 0
              ? '$unanswered question${unanswered == 1 ? '' : 's'} unanswered. Submit anyway?'
              : 'Are you sure you want to submit?',
          style: const TextStyle(color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              notifier.submitQuiz();
            },
            child: const Text('Submit'),
          ),
        ],
      ),
    );
  }

  void _showExitConfirmation(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.cardBg,
        title: const Text('Leave Quiz?',
            style: TextStyle(color: AppColors.textPrimary)),
        content: const Text(
          'Your progress will be lost. Are you sure?',
          style: TextStyle(color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Stay'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.pop();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
            ),
            child: const Text('Leave'),
          ),
        ],
      ),
    );
  }

  void _showGracePeriodDialog(
    BuildContext context,
    QuizTakingState state,
    QuizTakingNotifier notifier,
  ) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.cardBg,
        title: const Text("Time's Up!",
            style: TextStyle(color: AppColors.error)),
        content: Text(
          'Auto-submitting in ${state.gracePeriodSeconds} seconds...',
          style: const TextStyle(color: AppColors.textSecondary),
        ),
        actions: [
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              notifier.submitQuiz();
            },
            child: const Text('Submit Now'),
          ),
        ],
      ),
    );
  }
}

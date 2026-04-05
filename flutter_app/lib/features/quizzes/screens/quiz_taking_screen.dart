import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:ict_lms_student/core/constants/app_animations.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/core/utils/responsive.dart';
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
        backgroundColor: AppColors.scaffoldBg,
        appBar: AppBar(
          title: Text('Quiz', style: AppTextStyles.headline),
          backgroundColor: AppColors.cardBg,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
        ),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (state.error != null && state.questions.isEmpty) {
      return Scaffold(
        backgroundColor: AppColors.scaffoldBg,
        appBar: AppBar(
          title: Text('Quiz', style: AppTextStyles.headline),
          backgroundColor: AppColors.cardBg,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
        ),
        body: Center(
          child: Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: AppSpacing.space24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline,
                    color: AppColors.error, size: 48),
                const SizedBox(height: AppSpacing.space16),
                Text(state.error!, style: AppTextStyles.subheadline,
                    textAlign: TextAlign.center),
              ],
            ),
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
        backgroundColor: AppColors.scaffoldBg,
        appBar: AppBar(
          title: Text(
            state.quiz!.title,
            style: AppTextStyles.headline,
          ),
          backgroundColor: AppColors.cardBg,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          actions: [
            if (state.remainingSeconds != null)
              Padding(
                padding: const EdgeInsets.only(right: AppSpacing.screenH),
                child: QuizTimer(
                  remainingSeconds: state.remainingSeconds!,
                  isWarning: state.isTimerWarning,
                ),
              ),
          ],
        ),
        body: Responsive.constrainWidth(
          context,
          child: Column(
          children: [
            // Progress bar with smooth animation.
            TweenAnimationBuilder<double>(
              tween: Tween<double>(
                begin: 0,
                end: state.questions.isNotEmpty
                    ? notifier.answeredCount / state.questions.length
                    : 0,
              ),
              duration: AppAnimations.normal,
              curve: AppAnimations.curveDefault,
              builder: (context, value, _) => LinearProgressIndicator(
                value: value,
                backgroundColor: AppColors.border,
                valueColor: AlwaysStoppedAnimation<Color>(accent),
                minHeight: 3,
              ),
            ),
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
              padding: EdgeInsets.symmetric(
                  horizontal: Responsive.screenPadding(context),
                  vertical: AppSpacing.space12),
              decoration: BoxDecoration(
                color: AppColors.cardBg,
                border: const Border(
                  top: BorderSide(color: AppColors.border),
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
                              final isAnswered = state.answers
                                  .containsKey(state.questions[i].id);
                              final isCurrent = i == state.currentPage;
                              return GestureDetector(
                                onTap: () => _pageController.animateToPage(
                                  i,
                                  duration: const Duration(milliseconds: 300),
                                  curve: Curves.easeInOut,
                                ),
                                child: AnimatedContainer(
                                  duration: AppAnimations.fast,
                                  curve: AppAnimations.curveDefault,
                                  width: isCurrent ? 12 : 8,
                                  height: isCurrent ? 12 : 8,
                                  margin: const EdgeInsets.symmetric(
                                      horizontal: 3),
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: isAnswered
                                        ? accent
                                        : isCurrent
                                            ? AppColors.textSecondary
                                            : AppColors.border,
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.space12),
                    // Progress text
                    Text(
                      '${notifier.answeredCount}/${state.questions.length}',
                      style: AppTextStyles.footnote.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.space12),
                    // Submit button
                    ElevatedButton(
                      onPressed: state.isSubmitting
                          ? null
                          : () {
                              AppAnimations.hapticMedium();
                              _confirmSubmit(context, state, notifier);
                            },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: accent,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 20, vertical: 10),
                        shape: RoundedRectangleBorder(
                          borderRadius:
                              BorderRadius.circular(AppSpacing.buttonRadius),
                        ),
                        elevation: 0,
                      ),
                      child: AnimatedSwitcher(
                        duration: AppAnimations.fast,
                        child: state.isSubmitting
                            ? const SizedBox(
                                key: ValueKey('submit_loading'),
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: Colors.white),
                              )
                            : Text(
                                'Submit',
                                key: const ValueKey('submit_text'),
                                style: AppTextStyles.subheadline.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
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
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
        ),
        title: Text('Submit Quiz?', style: AppTextStyles.headline),
        content: Text(
          unanswered > 0
              ? '$unanswered question${unanswered == 1 ? '' : 's'} unanswered. Submit anyway?'
              : 'Are you sure you want to submit?',
          style: AppTextStyles.subheadline,
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
            style: ElevatedButton.styleFrom(elevation: 0),
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
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
        ),
        title: Text('Leave Quiz?', style: AppTextStyles.headline),
        content: Text(
          'Your progress will be lost. Are you sure?',
          style: AppTextStyles.subheadline,
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
              elevation: 0,
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
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
        ),
        title: Text("Time's Up!",
            style: AppTextStyles.headline.copyWith(color: AppColors.error)),
        content: Text(
          'Auto-submitting in ${state.gracePeriodSeconds} seconds...',
          style: AppTextStyles.subheadline,
        ),
        actions: [
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              notifier.submitQuiz();
            },
            style: ElevatedButton.styleFrom(elevation: 0),
            child: const Text('Submit Now'),
          ),
        ],
      ),
    );
  }
}

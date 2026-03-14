import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/data/repositories/quiz_repository.dart';
import 'package:ict_lms_student/models/quiz_out.dart';
import 'package:ict_lms_student/models/quiz_question_out.dart';
import 'package:ict_lms_student/models/quiz_attempt_out.dart';

class QuizTakingState {
  final QuizOut? quiz;
  final List<QuizQuestionOut> questions;
  final Map<String, String> answers;
  final String? attemptId;
  final int currentPage;
  final int? remainingSeconds;
  final bool isTimerWarning;
  final bool isGracePeriod;
  final int gracePeriodSeconds;
  final bool isLoading;
  final bool isSubmitting;
  final bool isSubmitted;
  final QuizAttemptOut? result;
  final String? error;

  const QuizTakingState({
    this.quiz,
    this.questions = const [],
    this.answers = const {},
    this.attemptId,
    this.currentPage = 0,
    this.remainingSeconds,
    this.isTimerWarning = false,
    this.isGracePeriod = false,
    this.gracePeriodSeconds = 10,
    this.isLoading = false,
    this.isSubmitting = false,
    this.isSubmitted = false,
    this.result,
    this.error,
  });

  QuizTakingState copyWith({
    QuizOut? quiz,
    List<QuizQuestionOut>? questions,
    Map<String, String>? answers,
    String? attemptId,
    int? currentPage,
    int? remainingSeconds,
    bool? clearRemainingSeconds,
    bool? isTimerWarning,
    bool? isGracePeriod,
    int? gracePeriodSeconds,
    bool? isLoading,
    bool? isSubmitting,
    bool? isSubmitted,
    QuizAttemptOut? result,
    String? error,
    bool? clearError,
  }) {
    return QuizTakingState(
      quiz: quiz ?? this.quiz,
      questions: questions ?? this.questions,
      answers: answers ?? this.answers,
      attemptId: attemptId ?? this.attemptId,
      currentPage: currentPage ?? this.currentPage,
      remainingSeconds: (clearRemainingSeconds == true)
          ? null
          : (remainingSeconds ?? this.remainingSeconds),
      isTimerWarning: isTimerWarning ?? this.isTimerWarning,
      isGracePeriod: isGracePeriod ?? this.isGracePeriod,
      gracePeriodSeconds: gracePeriodSeconds ?? this.gracePeriodSeconds,
      isLoading: isLoading ?? this.isLoading,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      isSubmitted: isSubmitted ?? this.isSubmitted,
      result: result ?? this.result,
      error: (clearError == true) ? null : (error ?? this.error),
    );
  }
}

class QuizTakingNotifier extends StateNotifier<QuizTakingState> {
  final QuizRepository _repo;
  Timer? _timer;
  DateTime? _endTime;

  QuizTakingNotifier(this._repo) : super(const QuizTakingState());

  int get answeredCount =>
      state.answers.values.where((v) => v.isNotEmpty).length;

  Future<void> loadQuiz(QuizOut quiz) async {
    state = state.copyWith(isLoading: true, clearError: true, quiz: quiz);

    try {
      final results = await Future.wait([
        _repo.getQuestions(quiz.id),
        _repo.startAttempt(quiz.id),
      ]);

      final questions = results[0] as List<QuizQuestionOut>;
      final attempt = results[1] as QuizAttemptOut;

      state = state.copyWith(
        questions: questions,
        attemptId: attempt.id,
        isLoading: false,
      );

      if (quiz.timeLimitMinutes != null && quiz.timeLimitMinutes! > 0) {
        _startTimer(quiz.timeLimitMinutes!);
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
    }
  }

  void _startTimer(int minutes) {
    _endTime = DateTime.now().add(Duration(minutes: minutes));
    _updateRemainingSeconds();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      _updateRemainingSeconds();
    });
  }

  void _updateRemainingSeconds() {
    if (_endTime == null) return;

    final remaining = _endTime!.difference(DateTime.now()).inSeconds;

    if (state.isGracePeriod) {
      final graceRemaining = state.gracePeriodSeconds - 1;
      if (graceRemaining <= 0) {
        _timer?.cancel();
        submitQuiz();
        return;
      }
      state = state.copyWith(
        gracePeriodSeconds: graceRemaining,
        remainingSeconds: 0,
      );
      return;
    }

    if (remaining <= 0) {
      state = state.copyWith(
        remainingSeconds: 0,
        isGracePeriod: true,
        gracePeriodSeconds: 10,
        isTimerWarning: true,
      );
      // Reset end time for grace period
      _endTime = DateTime.now().add(const Duration(seconds: 10));
      return;
    }

    state = state.copyWith(
      remainingSeconds: remaining,
      isTimerWarning: remaining <= 60,
    );
  }

  void setAnswer(String questionId, String answerText) {
    final updatedAnswers = Map<String, String>.from(state.answers);
    updatedAnswers[questionId] = answerText;
    state = state.copyWith(answers: updatedAnswers);
  }

  void clearAnswer(String questionId) {
    final updatedAnswers = Map<String, String>.from(state.answers);
    updatedAnswers.remove(questionId);
    state = state.copyWith(answers: updatedAnswers);
  }

  void goToPage(int page) {
    state = state.copyWith(currentPage: page);
  }

  Future<void> submitQuiz() async {
    if (state.isSubmitted || state.isSubmitting) return;
    if (state.attemptId == null) return;

    state = state.copyWith(isSubmitting: true, clearError: true);
    _timer?.cancel();

    try {
      final answersList = state.answers.entries
          .map((e) => {
                'questionId': e.key,
                'answerText': e.value,
              })
          .toList();

      final result = await _repo.submitAttempt(state.attemptId!, answersList);

      state = state.copyWith(
        isSubmitting: false,
        isSubmitted: true,
        result: result,
      );
    } catch (e) {
      state = state.copyWith(
        isSubmitting: false,
        error: e.toString(),
      );
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

final quizTakingProvider =
    StateNotifierProvider.autoDispose<QuizTakingNotifier, QuizTakingState>(
  (ref) {
    final repo = ref.watch(quizRepositoryProvider);
    return QuizTakingNotifier(repo);
  },
);

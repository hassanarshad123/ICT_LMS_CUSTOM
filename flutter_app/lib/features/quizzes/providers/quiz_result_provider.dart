import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/data/repositories/quiz_repository.dart';
import 'package:ict_lms_student/models/quiz_attempt_out.dart';
import 'package:ict_lms_student/models/quiz_question_out.dart';

class QuizResultData {
  final QuizAttemptDetailOut attempt;
  final List<QuizQuestionOut> questions;

  const QuizResultData({
    required this.attempt,
    required this.questions,
  });
}

final quizResultProvider = FutureProvider.autoDispose
    .family<QuizResultData, ({String attemptId, String quizId})>(
  (ref, params) async {
    final repo = ref.watch(quizRepositoryProvider);
    final results = await Future.wait([
      repo.getAttemptDetail(params.attemptId),
      repo.getQuestions(params.quizId),
    ]);
    return QuizResultData(
      attempt: results[0] as QuizAttemptDetailOut,
      questions: results[1] as List<QuizQuestionOut>,
    );
  },
);

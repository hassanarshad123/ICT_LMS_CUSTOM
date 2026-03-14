import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/data/repositories/quiz_repository.dart';
import 'package:ict_lms_student/models/quiz_out.dart';

final quizListProvider = FutureProvider.autoDispose
    .family<List<QuizOut>, String>((ref, courseId) async {
  final repo = ref.watch(quizRepositoryProvider);
  return repo.listQuizzes(courseId: courseId);
});

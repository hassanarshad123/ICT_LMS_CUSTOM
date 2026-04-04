import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/data/repositories/course_repository.dart';
import 'package:ict_lms_student/data/repositories/lecture_repository.dart';
import 'package:ict_lms_student/data/repositories/curriculum_repository.dart';
import 'package:ict_lms_student/data/repositories/material_repository.dart';
import 'package:ict_lms_student/data/repositories/quiz_repository.dart';
import 'package:ict_lms_student/models/course_out.dart';
import 'package:ict_lms_student/models/lecture_out.dart';
import 'package:ict_lms_student/models/curriculum_module_out.dart';
import 'package:ict_lms_student/models/material_out.dart';
import 'package:ict_lms_student/models/batch_out.dart';
import 'package:ict_lms_student/models/paginated_response.dart';
import 'package:ict_lms_student/models/quiz_out.dart';
import 'package:ict_lms_student/data/repositories/batch_repository.dart';
import 'package:ict_lms_student/providers/auth_provider.dart';

class CourseDetailData {
  final CourseOut course;
  final List<LectureOut> lectures;
  final List<CurriculumModuleOut> modules;
  final List<MaterialOut> materials;
  final List<QuizOut> quizzes;
  final String resolvedBatchId;
  final BatchOut? batch;

  const CourseDetailData({
    required this.course,
    required this.lectures,
    required this.modules,
    required this.materials,
    this.quizzes = const [],
    required this.resolvedBatchId,
    this.batch,
  });

  bool get isAccessExpired => batch?.accessExpired == true;

  DateTime? get effectiveEndDate => batch?.effectiveEndDate ?? batch?.endDate;

  int? get daysLeft {
    final end = effectiveEndDate;
    if (end == null) return null;
    return end.difference(DateTime.now()).inDays;
  }
}

final courseDetailProvider = FutureProvider.autoDispose
    .family<CourseDetailData, String>((ref, courseId) async {
  final courseRepo = ref.watch(courseRepositoryProvider);
  final lectureRepo = ref.watch(lectureRepositoryProvider);
  final curriculumRepo = ref.watch(curriculumRepositoryProvider);
  final materialRepo = ref.watch(materialRepositoryProvider);
  final quizRepo = ref.watch(quizRepositoryProvider);
  final batchRepo = ref.watch(batchRepositoryProvider);

  // Fetch the course first to get its batchIds.
  final course = await courseRepo.getCourse(courseId);

  // Batch ID resolution: intersect course.batchIds with user.batchIds.
  final authState = ref.read(authProvider);
  final userBatchIds = authState.user?.batchIds ?? [];
  final courseBatchIds = course.batchIds;

  String resolvedBatchId;
  if (courseBatchIds.isEmpty) {
    resolvedBatchId = userBatchIds.isNotEmpty ? userBatchIds.first : '';
  } else {
    resolvedBatchId = courseBatchIds.firstWhere(
      (id) => userBatchIds.contains(id),
      orElse: () => courseBatchIds.first,
    );
  }

  // Fetch batch info for access expiry check (best-effort).
  BatchOut? batch;
  if (resolvedBatchId.isNotEmpty) {
    try {
      batch = await batchRepo.getBatch(resolvedBatchId);
    } catch (_) {
      // Best-effort — batch info unavailable won't break the page
    }
  }

  // Fetch lectures, curriculum, and materials in parallel.
  // Each wrapped so a single failure doesn't break the whole page.
  final emptyLectures = PaginatedResponse<LectureOut>(data: [], total: 0, page: 1, perPage: 50, totalPages: 0);
  final emptyMaterials = PaginatedResponse<MaterialOut>(data: [], total: 0, page: 1, perPage: 50, totalPages: 0);

  final results = await Future.wait([
    (resolvedBatchId.isNotEmpty
            ? lectureRepo.listLectures(batchId: resolvedBatchId, courseId: courseId)
            : Future.value(emptyLectures))
        .catchError((_) => emptyLectures),
    curriculumRepo.listModules(courseId).catchError((_) => <CurriculumModuleOut>[]),
    (resolvedBatchId.isNotEmpty
            ? materialRepo.listMaterials(batchId: resolvedBatchId, courseId: courseId)
            : Future.value(emptyMaterials))
        .catchError((_) => emptyMaterials),
    quizRepo.listQuizzes(courseId: courseId).catchError((_) => <QuizOut>[]),
  ]);

  final lectureResult = results[0] as PaginatedResponse<LectureOut>;
  final modules = results[1] as List<CurriculumModuleOut>;
  final materialResult = results[2] as PaginatedResponse<MaterialOut>;
  final quizzes = results[3] as List<QuizOut>;

  return CourseDetailData(
    course: course,
    lectures: lectureResult.data,
    modules: modules,
    materials: materialResult.data,
    quizzes: quizzes,
    resolvedBatchId: resolvedBatchId,
    batch: batch,
  );
});

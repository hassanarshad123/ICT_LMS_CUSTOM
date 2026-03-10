import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/data/repositories/course_repository.dart';
import 'package:ict_lms_student/data/repositories/lecture_repository.dart';
import 'package:ict_lms_student/data/repositories/curriculum_repository.dart';
import 'package:ict_lms_student/data/repositories/material_repository.dart';
import 'package:ict_lms_student/models/course_out.dart';
import 'package:ict_lms_student/models/lecture_out.dart';
import 'package:ict_lms_student/models/curriculum_module_out.dart';
import 'package:ict_lms_student/models/material_out.dart';
import 'package:ict_lms_student/providers/auth_provider.dart';

class CourseDetailData {
  final CourseOut course;
  final List<LectureOut> lectures;
  final List<CurriculumModuleOut> modules;
  final List<MaterialOut> materials;
  final String resolvedBatchId;

  const CourseDetailData({
    required this.course,
    required this.lectures,
    required this.modules,
    required this.materials,
    required this.resolvedBatchId,
  });
}

final courseDetailProvider = FutureProvider.autoDispose
    .family<CourseDetailData, String>((ref, courseId) async {
  final courseRepo = ref.watch(courseRepositoryProvider);
  final lectureRepo = ref.watch(lectureRepositoryProvider);
  final curriculumRepo = ref.watch(curriculumRepositoryProvider);
  final materialRepo = ref.watch(materialRepositoryProvider);

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

  // Fetch lectures, curriculum, and materials in parallel.
  final results = await Future.wait([
    resolvedBatchId.isNotEmpty
        ? lectureRepo.listLectures(
            batchId: resolvedBatchId,
            courseId: courseId,
          )
        : Future.value(<String, dynamic>{
            'data': <LectureOut>[],
            'total': 0,
            'page': 1,
            'perPage': 50,
            'totalPages': 0,
          }),
    curriculumRepo.listModules(courseId),
    resolvedBatchId.isNotEmpty
        ? materialRepo.listMaterials(
            batchId: resolvedBatchId,
            courseId: courseId,
          )
        : Future.value(<String, dynamic>{
            'data': <MaterialOut>[],
            'total': 0,
            'page': 1,
            'perPage': 50,
            'totalPages': 0,
          }),
  ]);

  final lectureResult = results[0] as Map<String, dynamic>;
  final modules = results[1] as List<CurriculumModuleOut>;
  final materialResult = results[2] as Map<String, dynamic>;

  return CourseDetailData(
    course: course,
    lectures: lectureResult['data'] as List<LectureOut>,
    modules: modules,
    materials: materialResult['data'] as List<MaterialOut>,
    resolvedBatchId: resolvedBatchId,
  );
});

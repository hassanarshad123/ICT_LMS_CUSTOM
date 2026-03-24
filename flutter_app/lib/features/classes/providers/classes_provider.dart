import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/data/repositories/zoom_repository.dart';
import 'package:ict_lms_student/models/zoom_class_out.dart';

class ClassesData {
  final List<ZoomClassOut> upcoming;
  final List<ZoomClassOut> past;

  const ClassesData({
    this.upcoming = const [],
    this.past = const [],
  });
}

final classesProvider =
    FutureProvider.autoDispose<ClassesData>((ref) async {
  final repo = ref.watch(zoomRepositoryProvider);

  // Fetch a large page of classes to split into upcoming/past locally.
  final result = await repo.listClasses(page: 1, perPage: 100);
  final allClasses = result.data;

  final upcoming = allClasses
      .where((c) => c.status == 'upcoming' || c.status == 'live')
      .toList()
    ..sort((a, b) => a.scheduledDate.compareTo(b.scheduledDate));

  final past = allClasses
      .where((c) => c.status == 'completed')
      .toList()
    ..sort((a, b) => b.scheduledDate.compareTo(a.scheduledDate));

  return ClassesData(upcoming: upcoming, past: past);
});

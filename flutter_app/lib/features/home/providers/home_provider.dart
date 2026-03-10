import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/repositories/batch_repository.dart';
import '../../../data/repositories/announcement_repository.dart';
import '../../../data/repositories/zoom_repository.dart';
import '../../../models/batch_out.dart';
import '../../../models/announcement_out.dart';
import '../../../models/zoom_class_out.dart';

/// Holds all data displayed on the home dashboard.
class HomeDashboardData {
  final List<BatchOut> batches;
  final List<AnnouncementOut> announcements;
  final List<ZoomClassOut> upcomingClasses;
  final int totalBatches;
  final int totalCourses;
  final int totalUpcomingClasses;

  const HomeDashboardData({
    required this.batches,
    required this.announcements,
    required this.upcomingClasses,
    required this.totalBatches,
    required this.totalCourses,
    required this.totalUpcomingClasses,
  });
}

/// FutureProvider that fetches batches, announcements, and upcoming classes
/// in parallel for the home dashboard.
///
/// Auto-disposes when the home screen is no longer visible.
final homeProvider = FutureProvider.autoDispose<HomeDashboardData>((ref) async {
  final batchRepo = ref.watch(batchRepositoryProvider);
  final announcementRepo = ref.watch(announcementRepositoryProvider);
  final zoomRepo = ref.watch(zoomRepositoryProvider);

  // Fetch all three in parallel
  final results = await Future.wait([
    batchRepo.listBatches(page: 1, perPage: 10),
    announcementRepo.listAnnouncements(page: 1, perPage: 5),
    zoomRepo.listClasses(page: 1, perPage: 5, status: 'upcoming'),
  ]);

  final batchResult = results[0];
  final announcementResult = results[1];
  final classResult = results[2];

  final batches = (batchResult['data'] as List).cast<BatchOut>();
  final announcements =
      (announcementResult['data'] as List).cast<AnnouncementOut>();
  final upcomingClasses = (classResult['data'] as List).cast<ZoomClassOut>();

  // Calculate total courses across all batches
  final totalCourses =
      batches.fold<int>(0, (sum, batch) => sum + batch.courseCount);

  return HomeDashboardData(
    batches: batches,
    announcements: announcements,
    upcomingClasses: upcomingClasses,
    totalBatches: batchResult['total'] as int? ?? batches.length,
    totalCourses: totalCourses,
    totalUpcomingClasses: classResult['total'] as int? ?? upcomingClasses.length,
  );
});

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/repositories/batch_repository.dart';
import '../../../data/repositories/announcement_repository.dart';
import '../../../data/repositories/zoom_repository.dart';
import '../../../models/batch_out.dart';
import '../../../models/announcement_out.dart';
import '../../../models/paginated_response.dart';
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

  // Fetch all three in parallel — each wrapped in try-catch so a single
  // failure (e.g. zoom not configured) doesn't break the entire home screen.
  final emptyBatches = PaginatedResponse<BatchOut>(data: [], total: 0, page: 1, perPage: 10, totalPages: 0);
  final emptyAnnouncements = PaginatedResponse<AnnouncementOut>(data: [], total: 0, page: 1, perPage: 5, totalPages: 0);
  final emptyClasses = PaginatedResponse<ZoomClassOut>(data: [], total: 0, page: 1, perPage: 5, totalPages: 0);

  final futures = await Future.wait([
    batchRepo.listBatches(page: 1, perPage: 10).catchError((_) => emptyBatches),
    announcementRepo.listAnnouncements(page: 1, perPage: 5).catchError((_) => emptyAnnouncements),
    zoomRepo.listClasses(page: 1, perPage: 5, status: 'upcoming').catchError((_) => emptyClasses),
  ]);

  final batchResult = futures[0] as PaginatedResponse<BatchOut>;
  final announcementResult = futures[1] as PaginatedResponse<AnnouncementOut>;
  final classResult = futures[2] as PaginatedResponse<ZoomClassOut>;

  final batches = batchResult.data;
  final announcements = announcementResult.data;
  final upcomingClasses = classResult.data;

  final totalCourses =
      batches.fold<int>(0, (sum, batch) => sum + batch.courseCount);

  return HomeDashboardData(
    batches: batches,
    announcements: announcements,
    upcomingClasses: upcomingClasses,
    totalBatches: batchResult.total,
    totalCourses: totalCourses,
    totalUpcomingClasses: classResult.total,
  );
});

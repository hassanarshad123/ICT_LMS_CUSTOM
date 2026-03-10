import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../shared/widgets/page_error.dart';
import '../../../shared/widgets/shimmer_loading.dart';
import '../providers/home_provider.dart';
import '../widgets/greeting_banner.dart';
import '../widgets/stat_card.dart';
import '../widgets/batch_card.dart';
import '../widgets/announcement_preview.dart';
import '../widgets/upcoming_class_card.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final homeAsync = ref.watch(homeProvider);

    return Scaffold(
      body: SafeArea(
        child: homeAsync.when(
          loading: () => const _HomeShimmer(),
          error: (error, _) => PageError(
            message: error.toString(),
            onRetry: () => ref.invalidate(homeProvider),
          ),
          data: (data) => RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(homeProvider);
            },
            color: Theme.of(context).colorScheme.primary,
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 8),

                  // Greeting banner
                  const GreetingBanner(),
                  const SizedBox(height: 20),

                  // Stat cards row
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Row(
                      children: [
                        Expanded(
                          child: StatCard(
                            icon: Icons.school_rounded,
                            count: data.totalBatches,
                            label: 'Batches',
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: StatCard(
                            icon: Icons.book_rounded,
                            count: data.totalCourses,
                            label: 'Courses',
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: StatCard(
                            icon: Icons.videocam_rounded,
                            count: data.totalUpcomingClasses,
                            label: 'Upcoming',
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // My Batches section
                  if (data.batches.isNotEmpty) ...[
                    const _SectionHeader(title: 'My Batches'),
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 150,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: data.batches.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 12),
                        itemBuilder: (context, index) {
                          return BatchCard(batch: data.batches[index]);
                        },
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],

                  // Announcements section
                  if (data.announcements.isNotEmpty) ...[
                    const _SectionHeader(title: 'Announcements'),
                    const SizedBox(height: 12),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Column(
                        children: data.announcements
                            .map((announcement) => Padding(
                                  padding: const EdgeInsets.only(bottom: 12),
                                  child: AnnouncementPreview(
                                    announcement: announcement,
                                  ),
                                ))
                            .toList(),
                      ),
                    ),
                  ],

                  // Upcoming Classes section
                  if (data.upcomingClasses.isNotEmpty) ...[
                    const _SectionHeader(title: 'Upcoming Classes'),
                    const SizedBox(height: 12),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Column(
                        children: data.upcomingClasses
                            .map((zoomClass) => Padding(
                                  padding: const EdgeInsets.only(bottom: 12),
                                  child: UpcomingClassCard(
                                    zoomClass: zoomClass,
                                  ),
                                ))
                            .toList(),
                      ),
                    ),
                  ],

                  // Empty state when everything is empty
                  if (data.batches.isEmpty &&
                      data.announcements.isEmpty &&
                      data.upcomingClasses.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 40,
                      ),
                      child: Center(
                        child: Column(
                          children: [
                            Icon(
                              Icons.dashboard_rounded,
                              size: 64,
                              color: AppColors.textTertiary,
                            ),
                            const SizedBox(height: 16),
                            const Text(
                              'Welcome to your dashboard',
                              style: TextStyle(
                                color: AppColors.textPrimary,
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Your batches, courses, and classes will appear here',
                              style: TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 14,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    ),

                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;

  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Text(
        title,
        style: const TextStyle(
          color: AppColors.textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _HomeShimmer extends StatelessWidget {
  const _HomeShimmer();

  @override
  Widget build(BuildContext context) {
    return const SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(height: 8),
          ShimmerBanner(),
          SizedBox(height: 20),
          ShimmerStatRow(),
          SizedBox(height: 24),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 16),
            child: ShimmerCard(height: 24, width: 120),
          ),
          SizedBox(height: 12),
          ShimmerHorizontalList(),
          SizedBox(height: 24),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 16),
            child: ShimmerCard(height: 24, width: 140),
          ),
          SizedBox(height: 12),
          ShimmerList(itemCount: 3, itemHeight: 100),
        ],
      ),
    );
  }
}

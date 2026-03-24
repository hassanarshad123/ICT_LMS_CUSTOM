import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
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
      backgroundColor: AppColors.scaffoldBg,
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
              padding: const EdgeInsets.only(bottom: 80),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: AppSpacing.space8),

                  // Greeting banner
                  const GreetingBanner(),
                  const SizedBox(height: AppSpacing.space24),

                  // Stat cards row — horizontal scroll
                  SizedBox(
                    height: 110,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.screenH,
                      ),
                      children: [
                        StatCard(
                          icon: Icons.school_rounded,
                          count: data.totalBatches,
                          label: 'Batches',
                        ),
                        const SizedBox(width: AppSpacing.space12),
                        StatCard(
                          icon: Icons.book_rounded,
                          count: data.totalCourses,
                          label: 'Courses',
                        ),
                        const SizedBox(width: AppSpacing.space12),
                        StatCard(
                          icon: Icons.videocam_rounded,
                          count: data.totalUpcomingClasses,
                          label: 'Upcoming',
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.space24),

                  // My Batches section
                  if (data.batches.isNotEmpty) ...[
                    _SectionHeader(title: 'My Batches'),
                    const SizedBox(height: AppSpacing.space12),
                    SizedBox(
                      height: 150,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.screenH,
                        ),
                        itemCount: data.batches.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(width: AppSpacing.space12),
                        itemBuilder: (context, index) {
                          return BatchCard(batch: data.batches[index]);
                        },
                      ),
                    ),
                    const SizedBox(height: AppSpacing.space24),
                  ],

                  // Upcoming Classes section
                  if (data.upcomingClasses.isNotEmpty) ...[
                    _SectionHeader(title: 'Upcoming Classes'),
                    const SizedBox(height: AppSpacing.space12),
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.screenH,
                      ),
                      child: Column(
                        children: data.upcomingClasses
                            .map((zoomClass) => Padding(
                                  padding: const EdgeInsets.only(
                                    bottom: AppSpacing.space12,
                                  ),
                                  child: UpcomingClassCard(
                                    zoomClass: zoomClass,
                                  ),
                                ))
                            .toList(),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.space24),
                  ],

                  // Announcements section
                  if (data.announcements.isNotEmpty) ...[
                    _SectionHeader(title: 'Recent Announcements'),
                    const SizedBox(height: AppSpacing.space12),
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.screenH,
                      ),
                      child: Column(
                        children: data.announcements
                            .map((announcement) => Padding(
                                  padding: const EdgeInsets.only(
                                    bottom: AppSpacing.space12,
                                  ),
                                  child: AnnouncementPreview(
                                    announcement: announcement,
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
                        horizontal: AppSpacing.screenH,
                        vertical: AppSpacing.space40,
                      ),
                      child: Center(
                        child: Column(
                          children: [
                            Icon(
                              Icons.dashboard_rounded,
                              size: 64,
                              color: AppColors.textTertiary,
                            ),
                            const SizedBox(height: AppSpacing.space16),
                            Text(
                              'Welcome to your dashboard',
                              style: AppTextStyles.headline,
                            ),
                            const SizedBox(height: AppSpacing.space8),
                            Text(
                              'Your batches, courses, and classes will appear here',
                              style: AppTextStyles.subheadline,
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    ),

                  const SizedBox(height: AppSpacing.space24),
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
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.screenH),
      child: Text(
        title,
        style: AppTextStyles.title2,
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
          SizedBox(height: AppSpacing.space8),
          ShimmerBanner(),
          SizedBox(height: AppSpacing.space24),
          ShimmerStatRow(),
          SizedBox(height: AppSpacing.space24),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: AppSpacing.screenH),
            child: ShimmerCard(height: 24, width: 120),
          ),
          SizedBox(height: AppSpacing.space12),
          ShimmerHorizontalList(),
          SizedBox(height: AppSpacing.space24),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: AppSpacing.screenH),
            child: ShimmerCard(height: 24, width: 140),
          ),
          SizedBox(height: AppSpacing.space12),
          ShimmerList(itemCount: 3, itemHeight: 100),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_animations.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/responsive.dart';
import '../../../providers/auth_provider.dart';
import '../../../data/repositories/auth_repository.dart';
import '../../../shared/widgets/email_verify_banner.dart';
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
    final hPad = Responsive.screenPadding(context);
    final sGap = Responsive.sectionGap(context);
    final isTablet = !Responsive.isCompact(context);

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
              AppAnimations.hapticLight();
              ref.invalidate(homeProvider);
            },
            color: Theme.of(context).colorScheme.primary,
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.only(bottom: 88),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(height: isTablet ? AppSpacing.space16 : AppSpacing.space8),

                  // Greeting banner
                  const GreetingBanner(),

                  // Email verification banner (shows only if unverified)
                  Builder(builder: (context) {
                    final user = ref.watch(authProvider).user;
                    if (user != null && !user.emailVerified) {
                      return Padding(
                        padding: EdgeInsets.fromLTRB(hPad, AppSpacing.space8, hPad, 0),
                        child: EmailVerifyBanner(
                          email: user.email,
                          onResend: () async {
                            final repo = ref.read(authRepositoryProvider);
                            await repo.resendVerification(user.email);
                          },
                        ),
                      );
                    }
                    return const SizedBox.shrink();
                  }),
                  SizedBox(height: sGap),

                  // Stat cards — responsive: horizontal scroll on phone, row on tablet (section 1)
                  if (isTablet)
                    Padding(
                      padding: EdgeInsets.symmetric(horizontal: hPad),
                      child: Row(
                        children: [
                          Expanded(
                            child: StatCard(
                              icon: Icons.school_rounded,
                              count: data.totalBatches,
                              label: 'Batches',
                            ),
                          ),
                          const SizedBox(width: AppSpacing.space16),
                          Expanded(
                            child: StatCard(
                              icon: Icons.book_rounded,
                              count: data.totalCourses,
                              label: 'Courses',
                            ),
                          ),
                          const SizedBox(width: AppSpacing.space16),
                          Expanded(
                            child: StatCard(
                              icon: Icons.videocam_rounded,
                              count: data.totalUpcomingClasses,
                              label: 'Upcoming',
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    SizedBox(
                      height: 114,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        padding: EdgeInsets.symmetric(horizontal: hPad),
                        children: [
                          SizedBox(
                            width: 120,
                            child: StatCard(
                              icon: Icons.school_rounded,
                              count: data.totalBatches,
                              label: 'Batches',
                            ),
                          ),
                          const SizedBox(width: AppSpacing.space12),
                          SizedBox(
                            width: 120,
                            child: StatCard(
                              icon: Icons.book_rounded,
                              count: data.totalCourses,
                              label: 'Courses',
                            ),
                          ),
                          const SizedBox(width: AppSpacing.space12),
                          SizedBox(
                            width: 120,
                            child: StatCard(
                              icon: Icons.videocam_rounded,
                              count: data.totalUpcomingClasses,
                              label: 'Upcoming',
                            ),
                          ),
                        ],
                      ),
                    ),
                  SizedBox(height: sGap),

                  // My Batches section (section 2)
                  if (data.batches.isNotEmpty) ...[
                    _SectionHeader(title: 'My Batches', hPad: hPad),
                    const SizedBox(height: AppSpacing.listItemGap),
                    SizedBox(
                      height: 160,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        padding: EdgeInsets.symmetric(horizontal: hPad),
                        itemCount: data.batches.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(width: AppSpacing.listItemGap),
                        itemBuilder: (context, index) {
                          return BatchCard(batch: data.batches[index]);
                        },
                      ),
                    ),
                    SizedBox(height: sGap),
                  ],

                  // Upcoming Classes section (section 3)
                  if (data.upcomingClasses.isNotEmpty) ...[
                    _SectionHeader(title: 'Upcoming Classes', hPad: hPad),
                    const SizedBox(height: AppSpacing.listItemGap),
                    Padding(
                      padding: EdgeInsets.symmetric(horizontal: hPad),
                      child: isTablet
                          ? _buildGrid(
                              data.upcomingClasses
                                  .map((zoomClass) => UpcomingClassCard(zoomClass: zoomClass))
                                  .toList(),
                              Responsive.gridColumns(context),
                            )
                          : Column(
                              children: data.upcomingClasses
                                  .map((zoomClass) => Padding(
                                        padding: const EdgeInsets.only(
                                          bottom: AppSpacing.listItemGap,
                                        ),
                                        child: UpcomingClassCard(
                                          zoomClass: zoomClass,
                                        ),
                                      ))
                                  .toList(),
                            ),
                    ),
                    SizedBox(height: sGap),
                  ],

                  // Announcements section (section 4)
                  if (data.announcements.isNotEmpty) ...[
                    _SectionHeader(title: 'Recent Announcements', hPad: hPad),
                    const SizedBox(height: AppSpacing.listItemGap),
                    Padding(
                      padding: EdgeInsets.symmetric(horizontal: hPad),
                      child: isTablet
                          ? _buildGrid(
                              data.announcements
                                  .map((announcement) => AnnouncementPreview(announcement: announcement))
                                  .toList(),
                              Responsive.gridColumns(context),
                            )
                          : Column(
                              children: data.announcements
                                  .map((announcement) => Padding(
                                        padding: const EdgeInsets.only(
                                          bottom: AppSpacing.listItemGap,
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
                      padding: EdgeInsets.symmetric(
                        horizontal: hPad,
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

                  SizedBox(height: sGap),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// Build a simple grid from a list of widgets.
  Widget _buildGrid(List<Widget> children, int columns) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i += columns) {
      final rowChildren = <Widget>[];
      for (var j = 0; j < columns; j++) {
        if (i + j < children.length) {
          rowChildren.add(Expanded(child: children[i + j]));
        } else {
          rowChildren.add(const Expanded(child: SizedBox.shrink()));
        }
        if (j < columns - 1) {
          rowChildren.add(const SizedBox(width: AppSpacing.listItemGap));
        }
      }
      rows.add(Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.listItemGap),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: rowChildren,
        ),
      ));
    }
    return Column(children: rows);
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final double hPad;

  const _SectionHeader({required this.title, required this.hPad});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: hPad),
      child: Text(title, style: AppTextStyles.title2),
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
          SizedBox(height: AppSpacing.sectionGap),
          ShimmerStatRow(),
          SizedBox(height: AppSpacing.sectionGap),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: AppSpacing.screenH),
            child: ShimmerCard(height: 24, width: 120),
          ),
          SizedBox(height: AppSpacing.listItemGap),
          ShimmerHorizontalList(),
          SizedBox(height: AppSpacing.sectionGap),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: AppSpacing.screenH),
            child: ShimmerCard(height: 24, width: 140),
          ),
          SizedBox(height: AppSpacing.listItemGap),
          ShimmerList(itemCount: 3, itemHeight: 100),
        ],
      ),
    );
  }
}

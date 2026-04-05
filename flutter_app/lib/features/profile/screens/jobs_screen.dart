import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:ict_lms_student/core/constants/app_animations.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/utils/responsive.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/features/profile/providers/jobs_provider.dart';
import 'package:ict_lms_student/features/profile/widgets/application_card.dart';
import 'package:ict_lms_student/features/profile/widgets/job_card.dart';
import 'package:ict_lms_student/shared/widgets/shimmer_loading.dart';

class JobsScreen extends ConsumerStatefulWidget {
  const JobsScreen({super.key});

  @override
  ConsumerState<JobsScreen> createState() => _JobsScreenState();
}

class _JobsScreenState extends ConsumerState<JobsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref.read(jobsProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final accentColor = Theme.of(context).colorScheme.primary;

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        title: Text('Jobs', style: AppTextStyles.headline),
        backgroundColor: AppColors.cardBg,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: accentColor,
          indicatorWeight: 2.5,
          labelColor: accentColor,
          unselectedLabelColor: AppColors.textTertiary,
          labelStyle: AppTextStyles.subheadline.copyWith(
            fontWeight: FontWeight.w600,
          ),
          unselectedLabelStyle: AppTextStyles.subheadline,
          dividerColor: AppColors.border,
          tabs: const [
            Tab(text: 'Job Listings'),
            Tab(text: 'My Applications'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _JobsListTab(scrollController: _scrollController),
          const _ApplicationsTab(),
        ],
      ),
    );
  }
}

class _JobsListTab extends ConsumerWidget {
  final ScrollController scrollController;

  const _JobsListTab({required this.scrollController});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(jobsProvider);

    if (state.isLoading && state.items.isEmpty) {
      return const ShimmerList(itemCount: 5, itemHeight: 100);
    }

    if (state.error != null && state.items.isEmpty) {
      return Center(
        child: Padding(
          padding: EdgeInsets.all(Responsive.screenPadding(context)),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline,
                  color: AppColors.error, size: 48),
              const SizedBox(height: AppSpacing.space16),
              Text(
                state.error!,
                style: AppTextStyles.subheadline.copyWith(
                  color: AppColors.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.space16),
              TextButton(
                onPressed: () =>
                    ref.read(jobsProvider.notifier).refresh(),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (state.items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.work_off_outlined,
                color: AppColors.textTertiary, size: 64),
            const SizedBox(height: AppSpacing.space16),
            Text(
              'No job listings available',
              style: AppTextStyles.headline.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: Theme.of(context).colorScheme.primary,
      onRefresh: () {
        AppAnimations.hapticLight();
        return ref.read(jobsProvider.notifier).refresh();
      },
      child: ListView.builder(
        controller: scrollController,
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.screenH,
          AppSpacing.screenH,
          AppSpacing.screenH,
          80,
        ),
        itemCount: state.items.length + (state.isLoadingMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index == state.items.length) {
            return const Padding(
              padding: EdgeInsets.all(AppSpacing.space16),
              child: ShimmerCard(height: 100),
            );
          }

          final job = state.items[index];
          return JobCard(
            job: job,
            onTap: () => context.push('/profile/jobs/${job.id}'),
          );
        },
      ),
    );
  }
}

class _ApplicationsTab extends ConsumerWidget {
  const _ApplicationsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncData = ref.watch(myApplicationsProvider);

    return asyncData.when(
      loading: () => const ShimmerList(itemCount: 4, itemHeight: 100),
      error: (error, _) => Center(
        child: Padding(
          padding: EdgeInsets.all(Responsive.screenPadding(context)),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline,
                  color: AppColors.error, size: 48),
              const SizedBox(height: AppSpacing.space16),
              Text(
                error.toString().replaceFirst('Exception: ', ''),
                style: AppTextStyles.subheadline.copyWith(
                  color: AppColors.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.space16),
              TextButton(
                onPressed: () => ref.invalidate(myApplicationsProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
      data: (applications) {
        if (applications.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.assignment_outlined,
                    color: AppColors.textTertiary, size: 64),
                const SizedBox(height: AppSpacing.space16),
                Text(
                  'No applications yet',
                  style: AppTextStyles.headline.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: AppSpacing.space8),
                Text(
                  'Apply to jobs and track your applications here',
                  style: AppTextStyles.footnote.copyWith(
                    color: AppColors.textTertiary,
                  ),
                ),
              ],
            ),
          );
        }

        return RefreshIndicator(
          color: Theme.of(context).colorScheme.primary,
          onRefresh: () async {
            AppAnimations.hapticLight();
            ref.invalidate(myApplicationsProvider);
          },
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.screenH,
              AppSpacing.screenH,
              AppSpacing.screenH,
              80,
            ),
            itemCount: applications.length,
            itemBuilder: (context, index) {
              final application = applications[index];
              return ApplicationCard(application: application);
            },
          ),
        );
      },
    );
  }
}

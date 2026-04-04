import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/core/utils/responsive.dart';
import 'package:ict_lms_student/features/courses/providers/course_detail_provider.dart';
import 'package:ict_lms_student/features/courses/widgets/lecture_item.dart';
import 'package:ict_lms_student/features/courses/widgets/curriculum_module_item.dart';
import 'package:ict_lms_student/features/courses/widgets/material_item.dart';
import 'package:ict_lms_student/features/quizzes/screens/quiz_list_tab.dart';
import 'package:ict_lms_student/shared/widgets/access_expired_banner.dart';
import 'package:ict_lms_student/shared/widgets/shimmer_loading.dart';

class CourseDetailScreen extends ConsumerWidget {
  final String courseId;

  const CourseDetailScreen({super.key, required this.courseId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncData = ref.watch(courseDetailProvider(courseId));

    return asyncData.when(
      loading: () => Scaffold(
        backgroundColor: AppColors.scaffoldBg,
        appBar: AppBar(title: const Text('Course')),
        body: const ShimmerList(itemCount: 6, itemHeight: 72),
      ),
      error: (error, _) => Scaffold(
        backgroundColor: AppColors.scaffoldBg,
        appBar: AppBar(title: const Text('Course')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, color: AppColors.error, size: 48),
              const SizedBox(height: AppSpacing.space16),
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: AppSpacing.space24),
                child: Text(
                  error.toString(),
                  style: AppTextStyles.subheadline,
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: AppSpacing.space16),
              TextButton(
                onPressed: () =>
                    ref.invalidate(courseDetailProvider(courseId)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
      data: (data) => DefaultTabController(
        length: 4,
        child: Scaffold(
          backgroundColor: AppColors.scaffoldBg,
          appBar: AppBar(
            title: Hero(
              tag: 'course-${data.course.id}',
              child: Material(
                type: MaterialType.transparency,
                child: Text(
                  data.course.title,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).appBarTheme.titleTextStyle ??
                      Theme.of(context).textTheme.titleLarge,
                ),
              ),
            ),
            bottom: const TabBar(
              isScrollable: true,
              tabs: [
                Tab(text: 'Lectures'),
                Tab(text: 'Curriculum'),
                Tab(text: 'Materials'),
                Tab(text: 'Quizzes'),
              ],
            ),
          ),
          body: TabBarView(
            children: [
              // Lectures tab.
              data.lectures.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.videocam_off_outlined,
                            size: 48,
                            color: AppColors.textTertiary,
                          ),
                          const SizedBox(height: AppSpacing.space12),
                          Text(
                            'No lectures available',
                            style: AppTextStyles.subheadline,
                          ),
                        ],
                      ),
                    )
                  : Responsive.constrainWidth(
                      context,
                      child: ListView.builder(
                        padding: EdgeInsets.only(
                          left: Responsive.screenPadding(context),
                          right: Responsive.screenPadding(context),
                          top: Responsive.screenPadding(context),
                          bottom: 80,
                        ),
                        itemCount: data.lectures.length + (data.isAccessExpired || (data.daysLeft != null && data.daysLeft! <= 7) ? 1 : 0),
                        itemBuilder: (context, index) {
                          // Show expiry banner as first item
                          if ((data.isAccessExpired || (data.daysLeft != null && data.daysLeft! <= 7)) && index == 0) {
                            return AccessExpiredBanner(
                              isExpired: data.isAccessExpired,
                              effectiveEndDate: data.effectiveEndDate,
                            );
                          }
                          final lectureIndex = (data.isAccessExpired || (data.daysLeft != null && data.daysLeft! <= 7)) ? index - 1 : index;
                          final lecture = data.lectures[lectureIndex];
                          return Padding(
                            padding: const EdgeInsets.only(
                              bottom: AppSpacing.space8,
                            ),
                            child: Opacity(
                              opacity: data.isAccessExpired ? 0.5 : 1.0,
                              child: LectureItem(
                                lecture: lecture,
                                onTap: data.isAccessExpired
                                    ? null
                                    : () => context.push(
                                          '/courses/${data.course.id}/lecture/${lecture.id}',
                                        ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
              // Curriculum tab.
              data.modules.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.list_alt_rounded,
                            size: 48,
                            color: AppColors.textTertiary,
                          ),
                          const SizedBox(height: AppSpacing.space12),
                          Text(
                            'No curriculum available',
                            style: AppTextStyles.subheadline,
                          ),
                        ],
                      ),
                    )
                  : Responsive.constrainWidth(
                      context,
                      child: ListView.builder(
                        padding: EdgeInsets.only(
                          left: Responsive.screenPadding(context),
                          right: Responsive.screenPadding(context),
                          top: Responsive.screenPadding(context),
                          bottom: 80,
                        ),
                        itemCount: data.modules.length,
                        itemBuilder: (context, index) {
                          return CurriculumModuleItem(
                            module: data.modules[index],
                          );
                        },
                      ),
                    ),
              // Materials tab.
              data.materials.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.folder_open_rounded,
                            size: 48,
                            color: AppColors.textTertiary,
                          ),
                          const SizedBox(height: AppSpacing.space12),
                          Text(
                            'No materials available',
                            style: AppTextStyles.subheadline,
                          ),
                        ],
                      ),
                    )
                  : Responsive.constrainWidth(
                      context,
                      child: ListView.builder(
                        padding: EdgeInsets.only(
                          left: Responsive.screenPadding(context),
                          right: Responsive.screenPadding(context),
                          top: Responsive.screenPadding(context),
                          bottom: 80,
                        ),
                        itemCount: data.materials.length + (data.isAccessExpired || (data.daysLeft != null && data.daysLeft! <= 7) ? 1 : 0),
                        itemBuilder: (context, index) {
                          if ((data.isAccessExpired || (data.daysLeft != null && data.daysLeft! <= 7)) && index == 0) {
                            return AccessExpiredBanner(
                              isExpired: data.isAccessExpired,
                              effectiveEndDate: data.effectiveEndDate,
                            );
                          }
                          final matIndex = (data.isAccessExpired || (data.daysLeft != null && data.daysLeft! <= 7)) ? index - 1 : index;
                          return Padding(
                            padding: const EdgeInsets.only(
                              bottom: AppSpacing.space8,
                            ),
                            child: Opacity(
                              opacity: data.isAccessExpired ? 0.5 : 1.0,
                              child: MaterialItem(
                                material: data.materials[matIndex],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
              // Quizzes tab.
              QuizListTab(courseId: data.course.id),
            ],
          ),
        ),
      ),
    );
  }
}

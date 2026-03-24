import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/features/courses/providers/course_detail_provider.dart';
import 'package:ict_lms_student/features/courses/widgets/lecture_item.dart';
import 'package:ict_lms_student/features/courses/widgets/curriculum_module_item.dart';
import 'package:ict_lms_student/features/courses/widgets/material_item.dart';
import 'package:ict_lms_student/features/quizzes/screens/quiz_list_tab.dart';

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
        body: const Center(child: CupertinoActivityIndicator(radius: 14)),
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
            title: Text(
              data.course.title,
              overflow: TextOverflow.ellipsis,
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
                  : ListView.builder(
                      padding: const EdgeInsets.only(
                        left: AppSpacing.screenH,
                        right: AppSpacing.screenH,
                        top: AppSpacing.screenH,
                        bottom: 80,
                      ),
                      itemCount: data.lectures.length,
                      itemBuilder: (context, index) {
                        final lecture = data.lectures[index];
                        return Padding(
                          padding: const EdgeInsets.only(
                            bottom: AppSpacing.space8,
                          ),
                          child: LectureItem(
                            lecture: lecture,
                            onTap: () => context.push(
                              '/courses/${data.course.id}/lecture/${lecture.id}',
                            ),
                          ),
                        );
                      },
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
                  : ListView.builder(
                      padding: const EdgeInsets.only(
                        left: AppSpacing.screenH,
                        right: AppSpacing.screenH,
                        top: AppSpacing.screenH,
                        bottom: 80,
                      ),
                      itemCount: data.modules.length,
                      itemBuilder: (context, index) {
                        return CurriculumModuleItem(
                          module: data.modules[index],
                        );
                      },
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
                  : ListView.builder(
                      padding: const EdgeInsets.only(
                        left: AppSpacing.screenH,
                        right: AppSpacing.screenH,
                        top: AppSpacing.screenH,
                        bottom: 80,
                      ),
                      itemCount: data.materials.length,
                      itemBuilder: (context, index) {
                        return Padding(
                          padding: const EdgeInsets.only(
                            bottom: AppSpacing.space8,
                          ),
                          child: MaterialItem(
                            material: data.materials[index],
                          ),
                        );
                      },
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

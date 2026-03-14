import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
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
        appBar: AppBar(title: const Text('Course')),
        body: const Center(child: CircularProgressIndicator()),
      ),
      error: (error, _) => Scaffold(
        appBar: AppBar(title: const Text('Course')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, color: AppColors.error, size: 48),
              const SizedBox(height: 16),
              Text(
                error.toString(),
                style: const TextStyle(color: AppColors.textSecondary),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
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
          appBar: AppBar(
            title: Text(
              data.course.title,
              overflow: TextOverflow.ellipsis,
            ),
            bottom: TabBar(
              isScrollable: true,
              indicatorColor: Theme.of(context).colorScheme.primary,
              labelColor: Theme.of(context).colorScheme.primary,
              unselectedLabelColor: AppColors.textSecondary,
              tabs: [
                Tab(
                  text: 'Lectures (${data.lectures.length})',
                ),
                Tab(
                  text: 'Curriculum (${data.modules.length})',
                ),
                Tab(
                  text: 'Materials (${data.materials.length})',
                ),
                Tab(
                  text: 'Quizzes (${data.quizzes.length})',
                ),
              ],
            ),
          ),
          body: TabBarView(
            children: [
              // Lectures tab.
              data.lectures.isEmpty
                  ? const Center(
                      child: Text(
                        'No lectures available',
                        style:
                            TextStyle(color: AppColors.textSecondary),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: data.lectures.length,
                      itemBuilder: (context, index) {
                        final lecture = data.lectures[index];
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8),
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
                  ? const Center(
                      child: Text(
                        'No curriculum available',
                        style:
                            TextStyle(color: AppColors.textSecondary),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: data.modules.length,
                      itemBuilder: (context, index) {
                        return CurriculumModuleItem(
                          module: data.modules[index],
                        );
                      },
                    ),
              // Materials tab.
              data.materials.isEmpty
                  ? const Center(
                      child: Text(
                        'No materials available',
                        style:
                            TextStyle(color: AppColors.textSecondary),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: data.materials.length,
                      itemBuilder: (context, index) {
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8),
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

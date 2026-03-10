import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/features/courses/providers/courses_list_provider.dart';
import 'package:ict_lms_student/features/courses/widgets/batch_filter_chips.dart';
import 'package:ict_lms_student/features/courses/widgets/course_card.dart';
import 'package:ict_lms_student/providers/auth_provider.dart';

class CoursesListScreen extends ConsumerStatefulWidget {
  const CoursesListScreen({super.key});

  @override
  ConsumerState<CoursesListScreen> createState() => _CoursesListScreenState();
}

class _CoursesListScreenState extends ConsumerState<CoursesListScreen> {
  final ScrollController _scrollController = ScrollController();
  String? _selectedBatchId;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    // Load courses on first build.
    Future.microtask(() {
      ref.read(coursesListProvider.notifier).load();
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref.read(coursesListProvider.notifier).loadMore();
    }
  }

  void _onBatchChanged(String? batchId) {
    setState(() {
      _selectedBatchId = batchId;
    });
    ref.read(coursesListProvider.notifier).load(batchId: batchId);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(coursesListProvider);
    final authState = ref.watch(authProvider);
    final userBatchIds = authState.user?.batchIds ?? [];
    final userBatchNames = authState.user?.batchNames ?? [];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Courses'),
      ),
      body: Column(
        children: [
          // Batch filter chips.
          if (userBatchIds.isNotEmpty)
            BatchFilterChips(
              batchIds: userBatchIds,
              batchNames: userBatchNames,
              selectedBatchId: _selectedBatchId,
              onChanged: _onBatchChanged,
            ),
          // Course list.
          Expanded(
            child: _buildBody(state),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(CoursesListState state) {
    if (state.isLoading && state.items.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (state.error != null && state.items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, color: AppColors.error, size: 48),
            const SizedBox(height: 16),
            Text(
              state.error!,
              style: const TextStyle(color: AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: () =>
                  ref.read(coursesListProvider.notifier).refresh(),
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (state.items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.book_outlined,
                color: AppColors.textTertiary, size: 64),
            const SizedBox(height: 16),
            const Text(
              'No courses found',
              style: TextStyle(
                  color: AppColors.textSecondary, fontSize: 16),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => ref.read(coursesListProvider.notifier).refresh(),
      child: ListView.builder(
        controller: _scrollController,
        padding: const EdgeInsets.all(16),
        itemCount: state.items.length + (state.isLoadingMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index == state.items.length) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: CircularProgressIndicator(),
              ),
            );
          }

          final course = state.items[index];
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: CourseCard(
              course: course,
              onTap: () => context.push('/courses/${course.id}'),
            ),
          );
        },
      ),
    );
  }
}

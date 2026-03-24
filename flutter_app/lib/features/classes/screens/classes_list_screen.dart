import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/features/classes/providers/classes_provider.dart';
import 'package:ict_lms_student/features/classes/widgets/class_card.dart';

class ClassesListScreen extends ConsumerWidget {
  const ClassesListScreen({super.key});

  Future<void> _joinClass(BuildContext context, String? meetingUrl) async {
    if (meetingUrl == null || meetingUrl.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Meeting link not available'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final uri = Uri.parse(meetingUrl);
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not open meeting link'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncData = ref.watch(classesProvider);

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        title: Text('Classes', style: AppTextStyles.headline),
        backgroundColor: AppColors.cardBg,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.video_library_outlined,
                color: AppColors.textPrimary),
            tooltip: 'Recordings',
            onPressed: () => context.push('/classes/recordings'),
          ),
        ],
      ),
      body: asyncData.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline,
                    color: AppColors.error, size: 48),
                const SizedBox(height: AppSpacing.space16),
                Text(
                  error.toString().replaceFirst('Exception: ', ''),
                  style: AppTextStyles.subheadline,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.space16),
                TextButton(
                  onPressed: () => ref.invalidate(classesProvider),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (data) {
          if (data.upcoming.isEmpty && data.past.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.videocam_off_outlined,
                      color: AppColors.textTertiary, size: 64),
                  const SizedBox(height: AppSpacing.space16),
                  Text(
                    'No classes scheduled',
                    style: AppTextStyles.callout,
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(classesProvider),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.screenH,
                AppSpacing.space16,
                AppSpacing.screenH,
                80,
              ),
              children: [
                // Upcoming / Live section.
                if (data.upcoming.isNotEmpty) ...[
                  _SectionHeader(
                    title: 'Upcoming & Live',
                    count: data.upcoming.length,
                  ),
                  const SizedBox(height: AppSpacing.space12),
                  ...data.upcoming.map(
                    (zoomClass) => ClassCard(
                      zoomClass: zoomClass,
                      onTap: () =>
                          _joinClass(context, zoomClass.zoomMeetingUrl),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.space24),
                ],
                // Past section.
                if (data.past.isNotEmpty) ...[
                  _SectionHeader(
                    title: 'Past Classes',
                    count: data.past.length,
                  ),
                  const SizedBox(height: AppSpacing.space12),
                  ...data.past.map(
                    (zoomClass) => ClassCard(
                      zoomClass: zoomClass,
                    ),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final int count;

  const _SectionHeader({required this.title, required this.count});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(title, style: AppTextStyles.title3),
        const SizedBox(width: AppSpacing.space8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(
            color: AppColors.inputBg,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            '$count',
            style: AppTextStyles.caption1.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/features/courses/providers/lecture_player_provider.dart';
import 'package:ict_lms_student/providers/auth_provider.dart';
import 'package:ict_lms_student/shared/widgets/progress_bar.dart';
import 'package:ict_lms_student/shared/widgets/video_player_webview.dart';

class LecturePlayerScreen extends ConsumerStatefulWidget {
  final String lectureId;

  const LecturePlayerScreen({super.key, required this.lectureId});

  @override
  ConsumerState<LecturePlayerScreen> createState() =>
      _LecturePlayerScreenState();
}

class _LecturePlayerScreenState extends ConsumerState<LecturePlayerScreen> {
  @override
  void dispose() {
    // Post final progress before leaving.
    ref
        .read(lecturePlayerProvider(widget.lectureId).notifier)
        .postFinalProgress();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(lecturePlayerProvider(widget.lectureId));
    final userEmail = ref.watch(authProvider).user?.email ?? '';

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        title: Text(
          state.lecture?.title ?? 'Lecture',
          overflow: TextOverflow.ellipsis,
        ),
      ),
      body: state.isLoading
          ? const Center(child: CupertinoActivityIndicator(radius: 14))
          : state.error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline,
                          color: AppColors.error, size: 48),
                      const SizedBox(height: AppSpacing.space16),
                      Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.space24,
                        ),
                        child: Text(
                          state.error!,
                          style: AppTextStyles.subheadline,
                          textAlign: TextAlign.center,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.space16),
                      TextButton(
                        onPressed: () => ref.invalidate(
                            lecturePlayerProvider(widget.lectureId)),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : SingleChildScrollView(
                  padding: const EdgeInsets.only(bottom: 80),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Video player — full width with rounded corners
                      if (state.signedUrl != null)
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.screenH,
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(
                              AppSpacing.cardRadius,
                            ),
                            child: VideoPlayerWebView(
                              signedUrl: state.signedUrl!,
                              userEmail: userEmail,
                              videoType: state.videoType ?? 'external',
                            ),
                          ),
                        ),
                      // Lecture info
                      Padding(
                        padding: const EdgeInsets.all(AppSpacing.screenH),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              state.lecture?.title ?? '',
                              style: AppTextStyles.headline,
                            ),
                            if (state.lecture?.durationDisplay != null) ...[
                              const SizedBox(height: AppSpacing.space8),
                              Row(
                                children: [
                                  const Icon(
                                    Icons.access_time,
                                    size: 16,
                                    color: AppColors.textTertiary,
                                  ),
                                  const SizedBox(width: AppSpacing.space4),
                                  Text(
                                    state.lecture!.durationDisplay!,
                                    style: AppTextStyles.footnote,
                                  ),
                                ],
                              ),
                            ],
                            if (state.lecture?.description != null &&
                                state.lecture!.description!.isNotEmpty) ...[
                              const SizedBox(height: AppSpacing.space12),
                              Text(
                                state.lecture!.description!,
                                style: AppTextStyles.body.copyWith(
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                            // Progress bar
                            if (state.progress != null) ...[
                              const SizedBox(height: AppSpacing.space24),
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    'Progress',
                                    style: AppTextStyles.subheadline.copyWith(
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                  Text(
                                    '${state.progress!.watchPercentage}%',
                                    style: AppTextStyles.subheadline.copyWith(
                                      color: Theme.of(context)
                                          .colorScheme
                                          .primary,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: AppSpacing.space8),
                              ProgressBar(
                                percentage:
                                    state.progress!.watchPercentage.toDouble(),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }
}

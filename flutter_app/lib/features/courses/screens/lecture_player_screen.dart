import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
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
      appBar: AppBar(
        title: Text(
          state.lecture?.title ?? 'Lecture',
          overflow: TextOverflow.ellipsis,
        ),
      ),
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator())
          : state.error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.error_outline,
                          color: AppColors.error, size: 48),
                      const SizedBox(height: 16),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Text(
                          state.error!,
                          style: const TextStyle(
                              color: AppColors.textSecondary),
                          textAlign: TextAlign.center,
                        ),
                      ),
                      const SizedBox(height: 16),
                      TextButton(
                        onPressed: () => ref.invalidate(
                            lecturePlayerProvider(widget.lectureId)),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Video player.
                      if (state.signedUrl != null)
                        VideoPlayerWebView(
                          signedUrl: state.signedUrl!,
                          userEmail: userEmail,
                          videoType: state.videoType ?? 'external',
                        ),
                      // Lecture info.
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              state.lecture?.title ?? '',
                              style: const TextStyle(
                                color: AppColors.textPrimary,
                                fontSize: 20,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            if (state.lecture?.durationDisplay != null) ...[
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Icon(
                                    Icons.access_time,
                                    size: 16,
                                    color: AppColors.textTertiary,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    state.lecture!.durationDisplay!,
                                    style: const TextStyle(
                                      color: AppColors.textTertiary,
                                      fontSize: 14,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                            if (state.lecture?.description != null &&
                                state.lecture!.description!.isNotEmpty) ...[
                              const SizedBox(height: 12),
                              Text(
                                state.lecture!.description!,
                                style: const TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 14,
                                ),
                              ),
                            ],
                            // Progress bar.
                            if (state.progress != null) ...[
                              const SizedBox(height: 20),
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text(
                                    'Progress',
                                    style: TextStyle(
                                      color: AppColors.textSecondary,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                  Text(
                                    '${state.progress!.watchPercentage}%',
                                    style: TextStyle(
                                      color: Theme.of(context)
                                          .colorScheme
                                          .primary,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
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

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/core/constants/app_animations.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/features/classes/providers/recordings_provider.dart';
import 'package:ict_lms_student/features/classes/widgets/recording_card.dart';
import 'package:ict_lms_student/core/services/screen_protection_service.dart';
import 'package:ict_lms_student/providers/auth_provider.dart';
import 'package:ict_lms_student/providers/branding_provider.dart';
import 'package:ict_lms_student/providers/fullscreen_provider.dart';
import 'package:ict_lms_student/shared/widgets/shimmer_loading.dart';
import 'package:ict_lms_student/shared/widgets/video_player_webview.dart';

class RecordingsScreen extends ConsumerStatefulWidget {
  const RecordingsScreen({super.key});

  @override
  ConsumerState<RecordingsScreen> createState() => _RecordingsScreenState();
}

class _RecordingsScreenState extends ConsumerState<RecordingsScreen> {
  final ScrollController _scrollController = ScrollController();
  String? _playingUrl;
  String? _playingTitle;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref.read(recordingsProvider.notifier).loadMore();
    }
  }

  Future<void> _onRecordingTap(String recordingId, String title) async {
    final notifier = ref.read(recordingsProvider.notifier);
    await notifier.getSignedUrl(recordingId);

    if (!mounted) return;

    final state = ref.read(recordingsProvider);
    if (state.signedUrl != null && state.signedUrl!.isNotEmpty) {
      ScreenProtectionService.enable();
      setState(() {
        _playingUrl = state.signedUrl;
        _playingTitle = title;
      });
    } else if (state.error != null) {
      final isExpired = state.error!.toLowerCase().contains('expired');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(isExpired
              ? 'Your batch access has expired. Contact your institute for renewal.'
              : state.error!),
          backgroundColor: isExpired ? Colors.amber.shade800 : AppColors.error,
          duration: isExpired ? const Duration(seconds: 5) : const Duration(seconds: 3),
        ),
      );
    }
  }

  void _closePlayer() {
    ScreenProtectionService.disable();
    setState(() {
      _playingUrl = null;
      _playingTitle = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(recordingsProvider);
    final watermarkEnabled = ref.watch(brandingProvider).watermarkEnabled;
    final userEmail = watermarkEnabled
        ? ref.watch(authProvider.select((s) => s.user?.email ?? ''))
        : null;
    final isFullscreen = ref.watch(fullscreenProvider);

    if (isFullscreen && _playingUrl != null) {
      return PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) {
            ref.read(fullscreenProvider.notifier).exitFullscreen();
          }
        },
        child: Scaffold(
          backgroundColor: Colors.black,
          body: VideoPlayerWebView(
            signedUrl: _playingUrl!,
            userEmail: userEmail,
            videoType: 'bunny_embed',
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        title: Text('Recordings', style: AppTextStyles.headline),
        backgroundColor: AppColors.cardBg,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
      ),
      body: Column(
        children: [
          // Inline video player when a recording is selected.
          if (_playingUrl != null) ...[
            Container(
              color: Colors.black,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  VideoPlayerWebView(
                    signedUrl: _playingUrl!,
                    userEmail: userEmail,
                    videoType: 'bunny_embed',
                  ),
                  Container(
                    color: AppColors.cardBg,
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.screenH,
                        vertical: AppSpacing.space8),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            _playingTitle ?? 'Recording',
                            style: AppTextStyles.subheadline.copyWith(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w600,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close,
                              color: AppColors.textSecondary, size: 20),
                          onPressed: _closePlayer,
                          tooltip: 'Close player',
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
          // Recordings list.
          Expanded(
            child: _buildBody(state),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(RecordingsState state) {
    if (state.isLoading && state.items.isEmpty) {
      return const ShimmerList(itemCount: 5, itemHeight: 90);
    }

    if (state.error != null && state.items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline,
                  color: AppColors.error, size: 48),
              const SizedBox(height: AppSpacing.space16),
              Text(
                state.error!,
                style: AppTextStyles.subheadline,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.space16),
              TextButton(
                onPressed: () =>
                    ref.read(recordingsProvider.notifier).refresh(),
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
            Icon(Icons.video_library_outlined,
                color: AppColors.textTertiary, size: 64),
            const SizedBox(height: AppSpacing.space16),
            Text(
              'No recordings available',
              style: AppTextStyles.callout,
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: Theme.of(context).colorScheme.primary,
      onRefresh: () {
        AppAnimations.hapticLight();
        return ref.read(recordingsProvider.notifier).refresh();
      },
      child: ListView.builder(
        controller: _scrollController,
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.screenH,
          AppSpacing.space16,
          AppSpacing.screenH,
          80,
        ),
        itemCount: state.items.length + (state.isLoadingMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index == state.items.length) {
            return const Padding(
              padding: EdgeInsets.all(AppSpacing.space16),
              child: ShimmerCard(height: 90),
            );
          }

          final recording = state.items[index];
          return RecordingCard(
            recording: recording,
            onTap: recording.isReady
                ? () =>
                    _onRecordingTap(recording.id, recording.classTitle)
                : null,
          );
        },
      ),
    );
  }
}

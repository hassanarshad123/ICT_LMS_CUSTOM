import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/features/classes/providers/recordings_provider.dart';
import 'package:ict_lms_student/features/classes/widgets/recording_card.dart';
import 'package:ict_lms_student/providers/auth_provider.dart';
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
      setState(() {
        _playingUrl = state.signedUrl;
        _playingTitle = title;
      });
    } else if (state.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(state.error!),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  void _closePlayer() {
    setState(() {
      _playingUrl = null;
      _playingTitle = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(recordingsProvider);
    final userEmail =
        ref.watch(authProvider.select((s) => s.user?.email ?? ''));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Recordings'),
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
                  Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            _playingTitle ?? 'Recording',
                            style: const TextStyle(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
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
      return const Center(child: CircularProgressIndicator());
    }

    if (state.error != null && state.items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline,
                color: AppColors.error, size: 48),
            const SizedBox(height: 16),
            Text(
              state.error!,
              style: const TextStyle(color: AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: () =>
                  ref.read(recordingsProvider.notifier).refresh(),
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
            Icon(Icons.video_library_outlined,
                color: AppColors.textTertiary, size: 64),
            const SizedBox(height: 16),
            const Text(
              'No recordings available',
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 16,
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => ref.read(recordingsProvider.notifier).refresh(),
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

import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/data/repositories/lecture_repository.dart';
import 'package:ict_lms_student/models/lecture_out.dart';
import 'package:ict_lms_student/models/progress_out.dart';
import 'package:ict_lms_student/models/signed_url_response.dart';

class LecturePlayerState {
  final LectureOut? lecture;
  final String? signedUrl;
  final String? videoType;
  final ProgressOut? progress;
  final bool isLoading;
  final String? error;

  const LecturePlayerState({
    this.lecture,
    this.signedUrl,
    this.videoType,
    this.progress,
    this.isLoading = true,
    this.error,
  });

  LecturePlayerState copyWith({
    LectureOut? lecture,
    String? signedUrl,
    String? videoType,
    ProgressOut? progress,
    bool? isLoading,
    String? error,
    bool clearError = false,
  }) {
    return LecturePlayerState(
      lecture: lecture ?? this.lecture,
      signedUrl: signedUrl ?? this.signedUrl,
      videoType: videoType ?? this.videoType,
      progress: progress ?? this.progress,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class LecturePlayerNotifier extends StateNotifier<LecturePlayerState> {
  final LectureRepository _repo;
  final String _lectureId;
  Timer? _progressTimer;

  LecturePlayerNotifier(this._repo, this._lectureId)
      : super(const LecturePlayerState()) {
    _init();
  }

  Future<void> _init() async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      // Fetch lecture details and signed URL in parallel.
      final results = await Future.wait([
        _repo.getLecture(_lectureId),
        _repo.getSignedUrl(_lectureId),
        _repo.getProgress(_lectureId),
      ]);

      final lecture = results[0] as LectureOut;
      final signedUrlResp = results[1] as SignedUrlResponse;
      final progress = results[2] as ProgressOut;

      state = state.copyWith(
        lecture: lecture,
        signedUrl: signedUrlResp.url,
        videoType: signedUrlResp.type,
        progress: progress,
        isLoading: false,
        clearError: true,
      );

      // Start progress reporting every 30 seconds.
      _startProgressTimer();
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  void _startProgressTimer() {
    _progressTimer?.cancel();
    _progressTimer = Timer.periodic(
      const Duration(seconds: 30),
      (_) => _postProgress(),
    );
  }

  Future<void> _postProgress() async {
    final progress = state.progress;
    if (progress == null) return;

    try {
      await _repo.updateProgress(
        lectureId: _lectureId,
        watchPercentage: progress.watchPercentage,
        resumePositionSeconds: progress.resumePositionSeconds,
      );
    } catch (_) {
      // Silently ignore progress post failures.
    }
  }

  /// Update progress locally (called from WebView JS messages).
  void updateProgress({
    required int watchPercentage,
    int resumePositionSeconds = 0,
  }) {
    final newProgress = ProgressOut(
      lectureId: _lectureId,
      watchPercentage: watchPercentage,
      resumePositionSeconds: resumePositionSeconds,
      status: watchPercentage >= 95 ? 'completed' : 'in_progress',
    );
    state = state.copyWith(progress: newProgress);

    // Post immediately at 95% completion.
    if (watchPercentage >= 95) {
      _postProgress();
    }
  }

  /// Post final progress before leaving screen.
  Future<void> postFinalProgress() async {
    _progressTimer?.cancel();
    await _postProgress();
  }

  @override
  void dispose() {
    _progressTimer?.cancel();
    super.dispose();
  }
}

final lecturePlayerProvider = StateNotifierProvider.autoDispose
    .family<LecturePlayerNotifier, LecturePlayerState, String>(
        (ref, lectureId) {
  final repo = ref.watch(lectureRepositoryProvider);
  return LecturePlayerNotifier(repo, lectureId);
});

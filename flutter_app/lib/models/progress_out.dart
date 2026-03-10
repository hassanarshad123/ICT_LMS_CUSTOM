/// Matches ProgressOut from backend/app/schemas/lecture.py.
class ProgressOut {
  final String lectureId;
  final int watchPercentage;
  final int resumePositionSeconds;
  final String status;

  const ProgressOut({
    required this.lectureId,
    this.watchPercentage = 0,
    this.resumePositionSeconds = 0,
    required this.status,
  });

  factory ProgressOut.fromJson(Map<String, dynamic> json) {
    return ProgressOut(
      lectureId: json['lectureId']?.toString() ?? '',
      watchPercentage: json['watchPercentage'] as int? ?? 0,
      resumePositionSeconds: json['resumePositionSeconds'] as int? ?? 0,
      status: json['status'] as String? ?? 'unwatched',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'lectureId': lectureId,
      'watchPercentage': watchPercentage,
      'resumePositionSeconds': resumePositionSeconds,
      'status': status,
    };
  }

  ProgressOut copyWith({
    String? lectureId,
    int? watchPercentage,
    int? resumePositionSeconds,
    String? status,
  }) {
    return ProgressOut(
      lectureId: lectureId ?? this.lectureId,
      watchPercentage: watchPercentage ?? this.watchPercentage,
      resumePositionSeconds:
          resumePositionSeconds ?? this.resumePositionSeconds,
      status: status ?? this.status,
    );
  }

  /// Whether the lecture has been completed.
  bool get isCompleted => status == 'completed';

  /// Whether the lecture is currently in progress.
  bool get isInProgress => status == 'in_progress';

  @override
  String toString() =>
      'ProgressOut(lectureId: $lectureId, watchPercentage: $watchPercentage, status: $status)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ProgressOut &&
          runtimeType == other.runtimeType &&
          lectureId == other.lectureId;

  @override
  int get hashCode => lectureId.hashCode;
}

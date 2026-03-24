/// Matches LectureOut from backend/app/schemas/lecture.py.
class LectureOut {
  final String id;
  final String title;
  final String? description;
  final String videoType;
  final String? videoUrl;
  final String? bunnyVideoId;
  final String? videoStatus;
  final int? duration;
  final String? durationDisplay;
  final int? fileSize;
  final String batchId;
  final String? courseId;
  final int sequenceOrder;
  final String? thumbnailUrl;
  final DateTime? uploadDate;
  final DateTime? createdAt;
  // Progress gating fields (populated for students when batch has gating enabled)
  final int? watchPercentage;
  final String? progressStatus;
  final bool? isLocked;

  const LectureOut({
    required this.id,
    required this.title,
    this.description,
    required this.videoType,
    this.videoUrl,
    this.bunnyVideoId,
    this.videoStatus,
    this.duration,
    this.durationDisplay,
    this.fileSize,
    required this.batchId,
    this.courseId,
    this.sequenceOrder = 0,
    this.thumbnailUrl,
    this.uploadDate,
    this.createdAt,
    this.watchPercentage,
    this.progressStatus,
    this.isLocked,
  });

  factory LectureOut.fromJson(Map<String, dynamic> json) {
    return LectureOut(
      id: json['id']?.toString() ?? (throw const FormatException('LectureOut: missing id')),
      title: json['title'] as String? ?? '',
      description: json['description'] as String?,
      videoType: json['videoType'] as String? ?? 'external',
      videoUrl: json['videoUrl'] as String?,
      bunnyVideoId: json['bunnyVideoId'] as String?,
      videoStatus: json['videoStatus'] as String?,
      duration: json['duration'] as int?,
      durationDisplay: json['durationDisplay'] as String?,
      fileSize: json['fileSize'] as int?,
      batchId: json['batchId']?.toString() ?? '',
      courseId: json['courseId']?.toString(),
      sequenceOrder: json['sequenceOrder'] as int? ?? 0,
      thumbnailUrl: json['thumbnailUrl'] as String?,
      uploadDate: DateTime.tryParse(json['uploadDate']?.toString() ?? ''),
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
      watchPercentage: json['watchPercentage'] as int?,
      progressStatus: json['progressStatus'] as String?,
      isLocked: json['isLocked'] as bool?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'videoType': videoType,
      'videoUrl': videoUrl,
      'bunnyVideoId': bunnyVideoId,
      'videoStatus': videoStatus,
      'duration': duration,
      'durationDisplay': durationDisplay,
      'fileSize': fileSize,
      'batchId': batchId,
      'courseId': courseId,
      'sequenceOrder': sequenceOrder,
      'thumbnailUrl': thumbnailUrl,
      'uploadDate': uploadDate?.toIso8601String(),
      'createdAt': createdAt?.toIso8601String(),
      'watchPercentage': watchPercentage,
      'progressStatus': progressStatus,
      'isLocked': isLocked,
    };
  }

  LectureOut copyWith({
    String? id,
    String? title,
    String? description,
    String? videoType,
    String? videoUrl,
    String? bunnyVideoId,
    String? videoStatus,
    int? duration,
    String? durationDisplay,
    int? fileSize,
    String? batchId,
    String? courseId,
    int? sequenceOrder,
    String? thumbnailUrl,
    DateTime? uploadDate,
    DateTime? createdAt,
    int? watchPercentage,
    String? progressStatus,
    bool? isLocked,
  }) {
    return LectureOut(
      id: id ?? this.id,
      title: title ?? this.title,
      description: description ?? this.description,
      videoType: videoType ?? this.videoType,
      videoUrl: videoUrl ?? this.videoUrl,
      bunnyVideoId: bunnyVideoId ?? this.bunnyVideoId,
      videoStatus: videoStatus ?? this.videoStatus,
      duration: duration ?? this.duration,
      durationDisplay: durationDisplay ?? this.durationDisplay,
      fileSize: fileSize ?? this.fileSize,
      batchId: batchId ?? this.batchId,
      courseId: courseId ?? this.courseId,
      sequenceOrder: sequenceOrder ?? this.sequenceOrder,
      thumbnailUrl: thumbnailUrl ?? this.thumbnailUrl,
      uploadDate: uploadDate ?? this.uploadDate,
      createdAt: createdAt ?? this.createdAt,
      watchPercentage: watchPercentage ?? this.watchPercentage,
      progressStatus: progressStatus ?? this.progressStatus,
      isLocked: isLocked ?? this.isLocked,
    );
  }

  /// Whether this lecture has a playable video.
  /// Locked lectures (from lecture gating) are not playable.
  bool get isPlayable =>
      isLocked != true &&
      (videoStatus == 'ready' ||
       (videoType == 'external' && videoUrl != null && videoUrl!.isNotEmpty));

  @override
  String toString() =>
      'LectureOut(id: $id, title: $title, videoType: $videoType)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LectureOut && runtimeType == other.runtimeType && id == other.id;

  @override
  int get hashCode => id.hashCode;
}

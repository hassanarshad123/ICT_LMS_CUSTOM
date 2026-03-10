/// Matches RecordingListOut from backend/app/schemas/zoom.py.
class RecordingListOut {
  final String id;
  final String classTitle;
  final String? teacherName;
  final String? batchName;
  final DateTime? scheduledDate;
  final String? scheduledTime;
  final String? thumbnailUrl;
  final int? duration;
  final int? fileSize;
  final String status;
  final DateTime? createdAt;

  const RecordingListOut({
    required this.id,
    required this.classTitle,
    this.teacherName,
    this.batchName,
    this.scheduledDate,
    this.scheduledTime,
    this.thumbnailUrl,
    this.duration,
    this.fileSize,
    required this.status,
    this.createdAt,
  });

  factory RecordingListOut.fromJson(Map<String, dynamic> json) {
    return RecordingListOut(
      id: json['id']?.toString() ?? '',
      classTitle: json['classTitle'] as String? ?? '',
      teacherName: json['teacherName'] as String?,
      batchName: json['batchName'] as String?,
      scheduledDate:
          DateTime.tryParse(json['scheduledDate']?.toString() ?? ''),
      scheduledTime: json['scheduledTime'] as String?,
      thumbnailUrl: json['thumbnailUrl'] as String?,
      duration: json['duration'] as int?,
      fileSize: json['fileSize'] as int?,
      status: json['status'] as String? ?? 'processing',
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'classTitle': classTitle,
      'teacherName': teacherName,
      'batchName': batchName,
      'scheduledDate': scheduledDate?.toIso8601String(),
      'scheduledTime': scheduledTime,
      'thumbnailUrl': thumbnailUrl,
      'duration': duration,
      'fileSize': fileSize,
      'status': status,
      'createdAt': createdAt?.toIso8601String(),
    };
  }

  RecordingListOut copyWith({
    String? id,
    String? classTitle,
    String? teacherName,
    String? batchName,
    DateTime? scheduledDate,
    String? scheduledTime,
    String? thumbnailUrl,
    int? duration,
    int? fileSize,
    String? status,
    DateTime? createdAt,
  }) {
    return RecordingListOut(
      id: id ?? this.id,
      classTitle: classTitle ?? this.classTitle,
      teacherName: teacherName ?? this.teacherName,
      batchName: batchName ?? this.batchName,
      scheduledDate: scheduledDate ?? this.scheduledDate,
      scheduledTime: scheduledTime ?? this.scheduledTime,
      thumbnailUrl: thumbnailUrl ?? this.thumbnailUrl,
      duration: duration ?? this.duration,
      fileSize: fileSize ?? this.fileSize,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  /// Whether this recording is ready for playback.
  bool get isReady => status == 'ready';

  /// Whether this recording is still processing.
  bool get isProcessing => status == 'processing';

  /// Whether this recording failed.
  bool get isFailed => status == 'failed';

  @override
  String toString() =>
      'RecordingListOut(id: $id, classTitle: $classTitle, status: $status)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is RecordingListOut &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;
}

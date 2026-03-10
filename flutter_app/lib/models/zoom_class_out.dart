/// Matches ZoomClassOut from backend/app/schemas/zoom.py.
class ZoomClassOut {
  final String id;
  final String title;
  final String batchId;
  final String? batchName;
  final String teacherId;
  final String? teacherName;
  final String? zoomMeetingUrl;
  final String? zoomStartUrl;
  final String scheduledDate;
  final String scheduledTime;
  final int duration;
  final String? durationDisplay;
  final String status;
  final String zoomAccountId;
  final DateTime? createdAt;

  const ZoomClassOut({
    required this.id,
    required this.title,
    required this.batchId,
    this.batchName,
    required this.teacherId,
    this.teacherName,
    this.zoomMeetingUrl,
    this.zoomStartUrl,
    required this.scheduledDate,
    required this.scheduledTime,
    required this.duration,
    this.durationDisplay,
    required this.status,
    required this.zoomAccountId,
    this.createdAt,
  });

  factory ZoomClassOut.fromJson(Map<String, dynamic> json) {
    return ZoomClassOut(
      id: json['id']?.toString() ?? '',
      title: json['title'] as String? ?? '',
      batchId: json['batchId']?.toString() ?? '',
      batchName: json['batchName'] as String?,
      teacherId: json['teacherId']?.toString() ?? '',
      teacherName: json['teacherName'] as String?,
      zoomMeetingUrl: json['zoomMeetingUrl'] as String?,
      zoomStartUrl: json['zoomStartUrl'] as String?,
      scheduledDate: json['scheduledDate']?.toString() ?? '',
      scheduledTime: json['scheduledTime']?.toString() ?? '',
      duration: json['duration'] as int? ?? 0,
      durationDisplay: json['durationDisplay'] as String?,
      status: json['status'] as String? ?? 'upcoming',
      zoomAccountId: json['zoomAccountId']?.toString() ?? '',
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'batchId': batchId,
      'batchName': batchName,
      'teacherId': teacherId,
      'teacherName': teacherName,
      'zoomMeetingUrl': zoomMeetingUrl,
      'zoomStartUrl': zoomStartUrl,
      'scheduledDate': scheduledDate,
      'scheduledTime': scheduledTime,
      'duration': duration,
      'durationDisplay': durationDisplay,
      'status': status,
      'zoomAccountId': zoomAccountId,
      'createdAt': createdAt?.toIso8601String(),
    };
  }

  ZoomClassOut copyWith({
    String? id,
    String? title,
    String? batchId,
    String? batchName,
    String? teacherId,
    String? teacherName,
    String? zoomMeetingUrl,
    String? zoomStartUrl,
    String? scheduledDate,
    String? scheduledTime,
    int? duration,
    String? durationDisplay,
    String? status,
    String? zoomAccountId,
    DateTime? createdAt,
  }) {
    return ZoomClassOut(
      id: id ?? this.id,
      title: title ?? this.title,
      batchId: batchId ?? this.batchId,
      batchName: batchName ?? this.batchName,
      teacherId: teacherId ?? this.teacherId,
      teacherName: teacherName ?? this.teacherName,
      zoomMeetingUrl: zoomMeetingUrl ?? this.zoomMeetingUrl,
      zoomStartUrl: zoomStartUrl ?? this.zoomStartUrl,
      scheduledDate: scheduledDate ?? this.scheduledDate,
      scheduledTime: scheduledTime ?? this.scheduledTime,
      duration: duration ?? this.duration,
      durationDisplay: durationDisplay ?? this.durationDisplay,
      status: status ?? this.status,
      zoomAccountId: zoomAccountId ?? this.zoomAccountId,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  /// Whether this class is currently live.
  bool get isLive => status == 'live';

  /// Whether this class is upcoming.
  bool get isUpcoming => status == 'upcoming';

  /// Whether this class has completed.
  bool get isCompleted => status == 'completed';

  @override
  String toString() =>
      'ZoomClassOut(id: $id, title: $title, status: $status)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ZoomClassOut &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;
}

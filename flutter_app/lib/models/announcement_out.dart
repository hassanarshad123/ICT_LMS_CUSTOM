/// Matches AnnouncementOut from backend/app/schemas/announcement.py.
class AnnouncementOut {
  final String id;
  final String title;
  final String content;
  final String scope;
  final String? batchId;
  final String? courseId;
  final String? postedBy;
  final String? postedByName;
  final DateTime? expiresAt;
  final DateTime? createdAt;

  const AnnouncementOut({
    required this.id,
    required this.title,
    required this.content,
    required this.scope,
    this.batchId,
    this.courseId,
    this.postedBy,
    this.postedByName,
    this.expiresAt,
    this.createdAt,
  });

  factory AnnouncementOut.fromJson(Map<String, dynamic> json) {
    return AnnouncementOut(
      id: json['id']?.toString() ?? '',
      title: json['title'] as String? ?? '',
      content: json['content'] as String? ?? '',
      scope: json['scope'] as String? ?? 'institute',
      batchId: json['batchId']?.toString(),
      courseId: json['courseId']?.toString(),
      postedBy: json['postedBy']?.toString(),
      postedByName: json['postedByName'] as String?,
      expiresAt: DateTime.tryParse(json['expiresAt']?.toString() ?? ''),
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'content': content,
      'scope': scope,
      'batchId': batchId,
      'courseId': courseId,
      'postedBy': postedBy,
      'postedByName': postedByName,
      'expiresAt': expiresAt?.toIso8601String(),
      'createdAt': createdAt?.toIso8601String(),
    };
  }

  AnnouncementOut copyWith({
    String? id,
    String? title,
    String? content,
    String? scope,
    String? batchId,
    String? courseId,
    String? postedBy,
    String? postedByName,
    DateTime? expiresAt,
    DateTime? createdAt,
  }) {
    return AnnouncementOut(
      id: id ?? this.id,
      title: title ?? this.title,
      content: content ?? this.content,
      scope: scope ?? this.scope,
      batchId: batchId ?? this.batchId,
      courseId: courseId ?? this.courseId,
      postedBy: postedBy ?? this.postedBy,
      postedByName: postedByName ?? this.postedByName,
      expiresAt: expiresAt ?? this.expiresAt,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  /// Whether the announcement has expired.
  bool get isExpired =>
      expiresAt != null && expiresAt!.isBefore(DateTime.now());

  /// Human-readable scope label.
  String get scopeLabel {
    return switch (scope) {
      'institute' => 'Institute',
      'batch' => 'Batch',
      'course' => 'Course',
      _ => scope,
    };
  }

  @override
  String toString() =>
      'AnnouncementOut(id: $id, title: $title, scope: $scope)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AnnouncementOut &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;
}

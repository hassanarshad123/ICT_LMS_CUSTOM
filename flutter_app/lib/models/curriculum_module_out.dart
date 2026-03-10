/// Matches CurriculumModuleOut from backend/app/schemas/curriculum.py.
class CurriculumModuleOut {
  final String id;
  final String courseId;
  final String title;
  final String? description;
  final List<String>? topics;
  final int sequenceOrder;
  final DateTime? createdAt;

  const CurriculumModuleOut({
    required this.id,
    required this.courseId,
    required this.title,
    this.description,
    this.topics,
    this.sequenceOrder = 0,
    this.createdAt,
  });

  factory CurriculumModuleOut.fromJson(Map<String, dynamic> json) {
    return CurriculumModuleOut(
      id: json['id']?.toString() ?? '',
      courseId: json['courseId']?.toString() ?? '',
      title: json['title'] as String? ?? '',
      description: json['description'] as String?,
      topics: (json['topics'] as List<dynamic>?)
          ?.map((e) => e.toString())
          .toList(),
      sequenceOrder: json['sequenceOrder'] as int? ?? 0,
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'courseId': courseId,
      'title': title,
      'description': description,
      'topics': topics,
      'sequenceOrder': sequenceOrder,
      'createdAt': createdAt?.toIso8601String(),
    };
  }

  CurriculumModuleOut copyWith({
    String? id,
    String? courseId,
    String? title,
    String? description,
    List<String>? topics,
    int? sequenceOrder,
    DateTime? createdAt,
  }) {
    return CurriculumModuleOut(
      id: id ?? this.id,
      courseId: courseId ?? this.courseId,
      title: title ?? this.title,
      description: description ?? this.description,
      topics: topics ?? this.topics,
      sequenceOrder: sequenceOrder ?? this.sequenceOrder,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  String toString() =>
      'CurriculumModuleOut(id: $id, title: $title, courseId: $courseId)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CurriculumModuleOut &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;
}

/// Matches CourseOut from backend/app/schemas/course.py.
class CourseOut {
  final String id;
  final String title;
  final String? description;
  final String status;
  final List<String> batchIds;
  final String? clonedFromId;
  final String? createdBy;
  final DateTime? createdAt;

  const CourseOut({
    required this.id,
    required this.title,
    this.description,
    required this.status,
    this.batchIds = const [],
    this.clonedFromId,
    this.createdBy,
    this.createdAt,
  });

  factory CourseOut.fromJson(Map<String, dynamic> json) {
    return CourseOut(
      id: json['id']?.toString() ?? '',
      title: json['title'] as String? ?? '',
      description: json['description'] as String?,
      status: json['status'] as String? ?? '',
      batchIds: (json['batchIds'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      clonedFromId: json['clonedFromId']?.toString(),
      createdBy: json['createdBy']?.toString(),
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'status': status,
      'batchIds': batchIds,
      'clonedFromId': clonedFromId,
      'createdBy': createdBy,
      'createdAt': createdAt?.toIso8601String(),
    };
  }

  CourseOut copyWith({
    String? id,
    String? title,
    String? description,
    String? status,
    List<String>? batchIds,
    String? clonedFromId,
    String? createdBy,
    DateTime? createdAt,
  }) {
    return CourseOut(
      id: id ?? this.id,
      title: title ?? this.title,
      description: description ?? this.description,
      status: status ?? this.status,
      batchIds: batchIds ?? this.batchIds,
      clonedFromId: clonedFromId ?? this.clonedFromId,
      createdBy: createdBy ?? this.createdBy,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  String toString() => 'CourseOut(id: $id, title: $title, status: $status)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CourseOut && runtimeType == other.runtimeType && id == other.id;

  @override
  int get hashCode => id.hashCode;
}

/// Matches BatchOut from backend/app/schemas/batch.py.
class BatchOut {
  final String id;
  final String name;
  final DateTime? startDate;
  final DateTime? endDate;
  final String? teacherId;
  final String? teacherName;
  final int studentCount;
  final int courseCount;
  final String status;
  final String? createdBy;
  final DateTime? createdAt;

  const BatchOut({
    required this.id,
    required this.name,
    this.startDate,
    this.endDate,
    this.teacherId,
    this.teacherName,
    this.studentCount = 0,
    this.courseCount = 0,
    required this.status,
    this.createdBy,
    this.createdAt,
  });

  factory BatchOut.fromJson(Map<String, dynamic> json) {
    return BatchOut(
      id: json['id']?.toString() ?? '',
      name: json['name'] as String? ?? '',
      startDate: DateTime.tryParse(json['startDate']?.toString() ?? ''),
      endDate: DateTime.tryParse(json['endDate']?.toString() ?? ''),
      teacherId: json['teacherId']?.toString(),
      teacherName: json['teacherName'] as String?,
      studentCount: json['studentCount'] as int? ?? 0,
      courseCount: json['courseCount'] as int? ?? 0,
      status: json['status'] as String? ?? '',
      createdBy: json['createdBy']?.toString(),
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'startDate': startDate?.toIso8601String(),
      'endDate': endDate?.toIso8601String(),
      'teacherId': teacherId,
      'teacherName': teacherName,
      'studentCount': studentCount,
      'courseCount': courseCount,
      'status': status,
      'createdBy': createdBy,
      'createdAt': createdAt?.toIso8601String(),
    };
  }

  BatchOut copyWith({
    String? id,
    String? name,
    DateTime? startDate,
    DateTime? endDate,
    String? teacherId,
    String? teacherName,
    int? studentCount,
    int? courseCount,
    String? status,
    String? createdBy,
    DateTime? createdAt,
  }) {
    return BatchOut(
      id: id ?? this.id,
      name: name ?? this.name,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      teacherId: teacherId ?? this.teacherId,
      teacherName: teacherName ?? this.teacherName,
      studentCount: studentCount ?? this.studentCount,
      courseCount: courseCount ?? this.courseCount,
      status: status ?? this.status,
      createdBy: createdBy ?? this.createdBy,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  String toString() => 'BatchOut(id: $id, name: $name, status: $status)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is BatchOut && runtimeType == other.runtimeType && id == other.id;

  @override
  int get hashCode => id.hashCode;
}

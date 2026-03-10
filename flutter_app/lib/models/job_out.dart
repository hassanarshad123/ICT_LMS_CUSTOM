/// Matches JobOut from backend/app/schemas/job.py.
/// Note: The backend schema uses `type` as the field name for job type.
class JobOut {
  final String id;
  final String title;
  final String company;
  final String? location;
  final String type;
  final String? salary;
  final String? description;
  final List<String>? requirements;
  final DateTime? postedDate;
  final DateTime? deadline;
  final String? postedBy;

  const JobOut({
    required this.id,
    required this.title,
    required this.company,
    this.location,
    required this.type,
    this.salary,
    this.description,
    this.requirements,
    this.postedDate,
    this.deadline,
    this.postedBy,
  });

  factory JobOut.fromJson(Map<String, dynamic> json) {
    return JobOut(
      id: json['id']?.toString() ?? '',
      title: json['title'] as String? ?? '',
      company: json['company'] as String? ?? '',
      location: json['location'] as String?,
      type: json['type'] as String? ?? '',
      salary: json['salary'] as String?,
      description: json['description'] as String?,
      requirements: (json['requirements'] as List<dynamic>?)
          ?.map((e) => e.toString())
          .toList(),
      postedDate: DateTime.tryParse(json['postedDate']?.toString() ?? ''),
      deadline: DateTime.tryParse(json['deadline']?.toString() ?? ''),
      postedBy: json['postedBy']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'company': company,
      'location': location,
      'type': type,
      'salary': salary,
      'description': description,
      'requirements': requirements,
      'postedDate': postedDate?.toIso8601String(),
      'deadline': deadline?.toIso8601String(),
      'postedBy': postedBy,
    };
  }

  JobOut copyWith({
    String? id,
    String? title,
    String? company,
    String? location,
    String? type,
    String? salary,
    String? description,
    List<String>? requirements,
    DateTime? postedDate,
    DateTime? deadline,
    String? postedBy,
  }) {
    return JobOut(
      id: id ?? this.id,
      title: title ?? this.title,
      company: company ?? this.company,
      location: location ?? this.location,
      type: type ?? this.type,
      salary: salary ?? this.salary,
      description: description ?? this.description,
      requirements: requirements ?? this.requirements,
      postedDate: postedDate ?? this.postedDate,
      deadline: deadline ?? this.deadline,
      postedBy: postedBy ?? this.postedBy,
    );
  }

  /// Whether the job deadline has passed.
  bool get isExpired =>
      deadline != null && deadline!.isBefore(DateTime.now());

  /// Human-readable job type label.
  String get typeLabel {
    return switch (type) {
      'full_time' => 'Full Time',
      'part_time' => 'Part Time',
      'internship' => 'Internship',
      'remote' => 'Remote',
      _ => type,
    };
  }

  @override
  String toString() => 'JobOut(id: $id, title: $title, company: $company)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is JobOut && runtimeType == other.runtimeType && id == other.id;

  @override
  int get hashCode => id.hashCode;
}

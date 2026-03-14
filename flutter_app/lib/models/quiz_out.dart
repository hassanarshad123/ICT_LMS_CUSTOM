/// Matches QuizOut from backend/app/schemas/quiz.py.
class QuizOut {
  final String id;
  final String courseId;
  final String? moduleId;
  final String title;
  final String? description;
  final int? timeLimitMinutes;
  final int passPercentage;
  final int maxAttempts;
  final bool isPublished;
  final int sequenceOrder;
  final int questionCount;
  final String? createdBy;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const QuizOut({
    required this.id,
    required this.courseId,
    this.moduleId,
    required this.title,
    this.description,
    this.timeLimitMinutes,
    required this.passPercentage,
    required this.maxAttempts,
    required this.isPublished,
    required this.sequenceOrder,
    required this.questionCount,
    this.createdBy,
    this.createdAt,
    this.updatedAt,
  });

  factory QuizOut.fromJson(Map<String, dynamic> json) {
    return QuizOut(
      id: json['id']?.toString() ?? '',
      courseId: json['courseId']?.toString() ?? '',
      moduleId: json['moduleId']?.toString(),
      title: json['title'] as String? ?? '',
      description: json['description'] as String?,
      timeLimitMinutes: json['timeLimitMinutes'] as int?,
      passPercentage: json['passPercentage'] as int? ?? 0,
      maxAttempts: json['maxAttempts'] as int? ?? 0,
      isPublished: json['isPublished'] as bool? ?? false,
      sequenceOrder: json['sequenceOrder'] as int? ?? 0,
      questionCount: json['questionCount'] as int? ?? 0,
      createdBy: json['createdBy']?.toString(),
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
      updatedAt: DateTime.tryParse(json['updatedAt']?.toString() ?? ''),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'courseId': courseId,
      'moduleId': moduleId,
      'title': title,
      'description': description,
      'timeLimitMinutes': timeLimitMinutes,
      'passPercentage': passPercentage,
      'maxAttempts': maxAttempts,
      'isPublished': isPublished,
      'sequenceOrder': sequenceOrder,
      'questionCount': questionCount,
      'createdBy': createdBy,
      'createdAt': createdAt?.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }

  QuizOut copyWith({
    String? id,
    String? courseId,
    String? moduleId,
    String? title,
    String? description,
    int? timeLimitMinutes,
    int? passPercentage,
    int? maxAttempts,
    bool? isPublished,
    int? sequenceOrder,
    int? questionCount,
    String? createdBy,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return QuizOut(
      id: id ?? this.id,
      courseId: courseId ?? this.courseId,
      moduleId: moduleId ?? this.moduleId,
      title: title ?? this.title,
      description: description ?? this.description,
      timeLimitMinutes: timeLimitMinutes ?? this.timeLimitMinutes,
      passPercentage: passPercentage ?? this.passPercentage,
      maxAttempts: maxAttempts ?? this.maxAttempts,
      isPublished: isPublished ?? this.isPublished,
      sequenceOrder: sequenceOrder ?? this.sequenceOrder,
      questionCount: questionCount ?? this.questionCount,
      createdBy: createdBy ?? this.createdBy,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  String toString() => 'QuizOut(id: $id, title: $title)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is QuizOut && runtimeType == other.runtimeType && id == other.id;

  @override
  int get hashCode => id.hashCode;
}

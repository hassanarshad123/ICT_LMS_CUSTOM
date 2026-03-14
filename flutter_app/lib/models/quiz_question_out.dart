/// Matches QuestionOutStudent from backend/app/schemas/quiz.py.
/// Student view — no correctAnswer or explanation fields.
class QuizQuestionOut {
  final String id;
  final String quizId;
  final String questionType;
  final String questionText;
  final Map<String, dynamic>? options;
  final int points;
  final int sequenceOrder;
  final DateTime? createdAt;

  const QuizQuestionOut({
    required this.id,
    required this.quizId,
    required this.questionType,
    required this.questionText,
    this.options,
    required this.points,
    required this.sequenceOrder,
    this.createdAt,
  });

  factory QuizQuestionOut.fromJson(Map<String, dynamic> json) {
    return QuizQuestionOut(
      id: json['id']?.toString() ?? '',
      quizId: json['quizId']?.toString() ?? '',
      questionType: json['questionType'] as String? ?? '',
      questionText: json['questionText'] as String? ?? '',
      options: json['options'] as Map<String, dynamic>?,
      points: json['points'] as int? ?? 0,
      sequenceOrder: json['sequenceOrder'] as int? ?? 0,
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'quizId': quizId,
      'questionType': questionType,
      'questionText': questionText,
      'options': options,
      'points': points,
      'sequenceOrder': sequenceOrder,
      'createdAt': createdAt?.toIso8601String(),
    };
  }

  QuizQuestionOut copyWith({
    String? id,
    String? quizId,
    String? questionType,
    String? questionText,
    Map<String, dynamic>? options,
    int? points,
    int? sequenceOrder,
    DateTime? createdAt,
  }) {
    return QuizQuestionOut(
      id: id ?? this.id,
      quizId: quizId ?? this.quizId,
      questionType: questionType ?? this.questionType,
      questionText: questionText ?? this.questionText,
      options: options ?? this.options,
      points: points ?? this.points,
      sequenceOrder: sequenceOrder ?? this.sequenceOrder,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  String toString() =>
      'QuizQuestionOut(id: $id, type: $questionType, text: $questionText)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is QuizQuestionOut &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;
}

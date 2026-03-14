/// Matches AttemptOut from backend/app/schemas/quiz.py.
class QuizAttemptOut {
  final String id;
  final String quizId;
  final String studentId;
  final String status;
  final int? score;
  final int? maxScore;
  final int? percentage;
  final bool? passed;
  final DateTime? startedAt;
  final DateTime? submittedAt;
  final DateTime? gradedAt;

  const QuizAttemptOut({
    required this.id,
    required this.quizId,
    required this.studentId,
    required this.status,
    this.score,
    this.maxScore,
    this.percentage,
    this.passed,
    this.startedAt,
    this.submittedAt,
    this.gradedAt,
  });

  factory QuizAttemptOut.fromJson(Map<String, dynamic> json) {
    return QuizAttemptOut(
      id: json['id']?.toString() ?? '',
      quizId: json['quizId']?.toString() ?? '',
      studentId: json['studentId']?.toString() ?? '',
      status: json['status'] as String? ?? '',
      score: json['score'] as int?,
      maxScore: json['maxScore'] as int?,
      percentage: json['percentage'] as int?,
      passed: json['passed'] as bool?,
      startedAt: DateTime.tryParse(json['startedAt']?.toString() ?? ''),
      submittedAt: DateTime.tryParse(json['submittedAt']?.toString() ?? ''),
      gradedAt: DateTime.tryParse(json['gradedAt']?.toString() ?? ''),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'quizId': quizId,
      'studentId': studentId,
      'status': status,
      'score': score,
      'maxScore': maxScore,
      'percentage': percentage,
      'passed': passed,
      'startedAt': startedAt?.toIso8601String(),
      'submittedAt': submittedAt?.toIso8601String(),
      'gradedAt': gradedAt?.toIso8601String(),
    };
  }

  QuizAttemptOut copyWith({
    String? id,
    String? quizId,
    String? studentId,
    String? status,
    int? score,
    int? maxScore,
    int? percentage,
    bool? passed,
    DateTime? startedAt,
    DateTime? submittedAt,
    DateTime? gradedAt,
  }) {
    return QuizAttemptOut(
      id: id ?? this.id,
      quizId: quizId ?? this.quizId,
      studentId: studentId ?? this.studentId,
      status: status ?? this.status,
      score: score ?? this.score,
      maxScore: maxScore ?? this.maxScore,
      percentage: percentage ?? this.percentage,
      passed: passed ?? this.passed,
      startedAt: startedAt ?? this.startedAt,
      submittedAt: submittedAt ?? this.submittedAt,
      gradedAt: gradedAt ?? this.gradedAt,
    );
  }

  @override
  String toString() => 'QuizAttemptOut(id: $id, status: $status)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is QuizAttemptOut &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;
}

/// Matches AnswerOut from backend/app/schemas/quiz.py.
class QuizAnswerOut {
  final String id;
  final String questionId;
  final String? answerText;
  final bool? isCorrect;
  final int? pointsAwarded;
  final String? feedback;

  const QuizAnswerOut({
    required this.id,
    required this.questionId,
    this.answerText,
    this.isCorrect,
    this.pointsAwarded,
    this.feedback,
  });

  factory QuizAnswerOut.fromJson(Map<String, dynamic> json) {
    return QuizAnswerOut(
      id: json['id']?.toString() ?? '',
      questionId: json['questionId']?.toString() ?? '',
      answerText: json['answerText'] as String?,
      isCorrect: json['isCorrect'] as bool?,
      pointsAwarded: json['pointsAwarded'] as int?,
      feedback: json['feedback'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'questionId': questionId,
      'answerText': answerText,
      'isCorrect': isCorrect,
      'pointsAwarded': pointsAwarded,
      'feedback': feedback,
    };
  }

  QuizAnswerOut copyWith({
    String? id,
    String? questionId,
    String? answerText,
    bool? isCorrect,
    int? pointsAwarded,
    String? feedback,
  }) {
    return QuizAnswerOut(
      id: id ?? this.id,
      questionId: questionId ?? this.questionId,
      answerText: answerText ?? this.answerText,
      isCorrect: isCorrect ?? this.isCorrect,
      pointsAwarded: pointsAwarded ?? this.pointsAwarded,
      feedback: feedback ?? this.feedback,
    );
  }

  @override
  String toString() => 'QuizAnswerOut(id: $id, questionId: $questionId)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is QuizAnswerOut &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;
}

/// Matches AttemptDetailOut from backend/app/schemas/quiz.py.
/// Extends QuizAttemptOut with nested answers list.
class QuizAttemptDetailOut extends QuizAttemptOut {
  final List<QuizAnswerOut> answers;

  const QuizAttemptDetailOut({
    required super.id,
    required super.quizId,
    required super.studentId,
    required super.status,
    super.score,
    super.maxScore,
    super.percentage,
    super.passed,
    super.startedAt,
    super.submittedAt,
    super.gradedAt,
    this.answers = const [],
  });

  factory QuizAttemptDetailOut.fromJson(Map<String, dynamic> json) {
    return QuizAttemptDetailOut(
      id: json['id']?.toString() ?? '',
      quizId: json['quizId']?.toString() ?? '',
      studentId: json['studentId']?.toString() ?? '',
      status: json['status'] as String? ?? '',
      score: json['score'] as int?,
      maxScore: json['maxScore'] as int?,
      percentage: json['percentage'] as int?,
      passed: json['passed'] as bool?,
      startedAt: DateTime.tryParse(json['startedAt']?.toString() ?? ''),
      submittedAt: DateTime.tryParse(json['submittedAt']?.toString() ?? ''),
      gradedAt: DateTime.tryParse(json['gradedAt']?.toString() ?? ''),
      answers: (json['answers'] as List<dynamic>?)
              ?.map((e) => QuizAnswerOut.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  @override
  Map<String, dynamic> toJson() {
    final json = super.toJson();
    json['answers'] = answers.map((a) => a.toJson()).toList();
    return json;
  }
}

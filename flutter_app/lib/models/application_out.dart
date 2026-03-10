/// Matches ApplicationOut from backend/app/schemas/job.py.
class ApplicationOut {
  final String id;
  final String jobId;
  final String studentId;
  final String? studentName;
  final String? studentEmail;
  final String? resumeUrl;
  final String? coverLetter;
  final String status;
  final DateTime? createdAt;

  const ApplicationOut({
    required this.id,
    required this.jobId,
    required this.studentId,
    this.studentName,
    this.studentEmail,
    this.resumeUrl,
    this.coverLetter,
    required this.status,
    this.createdAt,
  });

  factory ApplicationOut.fromJson(Map<String, dynamic> json) {
    return ApplicationOut(
      id: json['id']?.toString() ?? '',
      jobId: json['jobId']?.toString() ?? '',
      studentId: json['studentId']?.toString() ?? '',
      studentName: json['studentName'] as String?,
      studentEmail: json['studentEmail'] as String?,
      resumeUrl: json['resumeUrl'] as String?,
      coverLetter: json['coverLetter'] as String?,
      status: json['status'] as String? ?? 'applied',
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'jobId': jobId,
      'studentId': studentId,
      'studentName': studentName,
      'studentEmail': studentEmail,
      'resumeUrl': resumeUrl,
      'coverLetter': coverLetter,
      'status': status,
      'createdAt': createdAt?.toIso8601String(),
    };
  }

  ApplicationOut copyWith({
    String? id,
    String? jobId,
    String? studentId,
    String? studentName,
    String? studentEmail,
    String? resumeUrl,
    String? coverLetter,
    String? status,
    DateTime? createdAt,
  }) {
    return ApplicationOut(
      id: id ?? this.id,
      jobId: jobId ?? this.jobId,
      studentId: studentId ?? this.studentId,
      studentName: studentName ?? this.studentName,
      studentEmail: studentEmail ?? this.studentEmail,
      resumeUrl: resumeUrl ?? this.resumeUrl,
      coverLetter: coverLetter ?? this.coverLetter,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  /// Human-readable status label.
  String get statusLabel {
    return switch (status) {
      'applied' => 'Applied',
      'shortlisted' => 'Shortlisted',
      'rejected' => 'Rejected',
      _ => status,
    };
  }

  /// Whether the application has been shortlisted.
  bool get isShortlisted => status == 'shortlisted';

  /// Whether the application has been rejected.
  bool get isRejected => status == 'rejected';

  @override
  String toString() =>
      'ApplicationOut(id: $id, jobId: $jobId, status: $status)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ApplicationOut &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;
}

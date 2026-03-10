/// Matches StudentDashboardCourseOut from backend/app/schemas/certificate.py.
class StudentDashboardCourse {
  final String batchId;
  final String batchName;
  final String courseId;
  final String courseTitle;
  final int completionPercentage;
  final int threshold;
  final String status;
  final String? certificateId;
  final String? certificateName;
  final DateTime? issuedAt;

  const StudentDashboardCourse({
    required this.batchId,
    required this.batchName,
    required this.courseId,
    required this.courseTitle,
    this.completionPercentage = 0,
    this.threshold = 80,
    required this.status,
    this.certificateId,
    this.certificateName,
    this.issuedAt,
  });

  factory StudentDashboardCourse.fromJson(Map<String, dynamic> json) {
    return StudentDashboardCourse(
      batchId: json['batchId']?.toString() ?? '',
      batchName: json['batchName'] as String? ?? '',
      courseId: json['courseId']?.toString() ?? '',
      courseTitle: json['courseTitle'] as String? ?? '',
      completionPercentage: json['completionPercentage'] as int? ?? 0,
      threshold: json['threshold'] as int? ?? 80,
      status: json['status'] as String? ?? 'not_started',
      certificateId: json['certificateId']?.toString(),
      certificateName: json['certificateName'] as String?,
      issuedAt: DateTime.tryParse(json['issuedAt']?.toString() ?? ''),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'batchId': batchId,
      'batchName': batchName,
      'courseId': courseId,
      'courseTitle': courseTitle,
      'completionPercentage': completionPercentage,
      'threshold': threshold,
      'status': status,
      'certificateId': certificateId,
      'certificateName': certificateName,
      'issuedAt': issuedAt?.toIso8601String(),
    };
  }

  StudentDashboardCourse copyWith({
    String? batchId,
    String? batchName,
    String? courseId,
    String? courseTitle,
    int? completionPercentage,
    int? threshold,
    String? status,
    String? certificateId,
    String? certificateName,
    DateTime? issuedAt,
  }) {
    return StudentDashboardCourse(
      batchId: batchId ?? this.batchId,
      batchName: batchName ?? this.batchName,
      courseId: courseId ?? this.courseId,
      courseTitle: courseTitle ?? this.courseTitle,
      completionPercentage:
          completionPercentage ?? this.completionPercentage,
      threshold: threshold ?? this.threshold,
      status: status ?? this.status,
      certificateId: certificateId ?? this.certificateId,
      certificateName: certificateName ?? this.certificateName,
      issuedAt: issuedAt ?? this.issuedAt,
    );
  }

  /// Whether the student has reached the threshold.
  bool get isEligible =>
      completionPercentage >= threshold ||
      status == 'eligible' ||
      status == 'pending' ||
      status == 'approved';

  /// Whether a certificate has been issued.
  bool get hasCertificate => status == 'approved' && issuedAt != null;

  @override
  String toString() =>
      'StudentDashboardCourse(courseTitle: $courseTitle, completion: $completionPercentage%, status: $status)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is StudentDashboardCourse &&
          runtimeType == other.runtimeType &&
          courseId == other.courseId &&
          batchId == other.batchId;

  @override
  int get hashCode => Object.hash(courseId, batchId);
}

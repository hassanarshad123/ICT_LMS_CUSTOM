/// Matches CertificateOut from backend/app/schemas/certificate.py.
class CertificateOut {
  final String id;
  final String studentId;
  final String studentName;
  final String studentEmail;
  final String batchId;
  final String batchName;
  final String courseId;
  final String courseTitle;
  final String? certificateId;
  final String? verificationCode;
  final String? certificateName;
  final DateTime? requestedAt;
  final String status;
  final int completionPercentage;
  final String? approvedBy;
  final DateTime? approvedAt;
  final DateTime? issuedAt;
  final DateTime? revokedAt;
  final String? revocationReason;
  final DateTime? createdAt;

  const CertificateOut({
    required this.id,
    required this.studentId,
    required this.studentName,
    required this.studentEmail,
    required this.batchId,
    required this.batchName,
    required this.courseId,
    required this.courseTitle,
    this.certificateId,
    this.verificationCode,
    this.certificateName,
    this.requestedAt,
    required this.status,
    this.completionPercentage = 0,
    this.approvedBy,
    this.approvedAt,
    this.issuedAt,
    this.revokedAt,
    this.revocationReason,
    this.createdAt,
  });

  factory CertificateOut.fromJson(Map<String, dynamic> json) {
    return CertificateOut(
      id: json['id']?.toString() ?? (throw const FormatException('CertificateOut: missing id')),
      studentId: json['studentId']?.toString() ?? '',
      studentName: json['studentName'] as String? ?? '',
      studentEmail: json['studentEmail'] as String? ?? '',
      batchId: json['batchId']?.toString() ?? '',
      batchName: json['batchName'] as String? ?? '',
      courseId: json['courseId']?.toString() ?? '',
      courseTitle: json['courseTitle'] as String? ?? '',
      certificateId: json['certificateId'] as String?,
      verificationCode: json['verificationCode'] as String?,
      certificateName: json['certificateName'] as String?,
      requestedAt: DateTime.tryParse(json['requestedAt']?.toString() ?? ''),
      status: json['status'] as String? ?? '',
      completionPercentage: json['completionPercentage'] as int? ?? 0,
      approvedBy: json['approvedBy']?.toString(),
      approvedAt: DateTime.tryParse(json['approvedAt']?.toString() ?? ''),
      issuedAt: DateTime.tryParse(json['issuedAt']?.toString() ?? ''),
      revokedAt: DateTime.tryParse(json['revokedAt']?.toString() ?? ''),
      revocationReason: json['revocationReason'] as String?,
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'studentId': studentId,
      'studentName': studentName,
      'studentEmail': studentEmail,
      'batchId': batchId,
      'batchName': batchName,
      'courseId': courseId,
      'courseTitle': courseTitle,
      'certificateId': certificateId,
      'verificationCode': verificationCode,
      'certificateName': certificateName,
      'requestedAt': requestedAt?.toIso8601String(),
      'status': status,
      'completionPercentage': completionPercentage,
      'approvedBy': approvedBy,
      'approvedAt': approvedAt?.toIso8601String(),
      'issuedAt': issuedAt?.toIso8601String(),
      'revokedAt': revokedAt?.toIso8601String(),
      'revocationReason': revocationReason,
      'createdAt': createdAt?.toIso8601String(),
    };
  }

  CertificateOut copyWith({
    String? id,
    String? studentId,
    String? studentName,
    String? studentEmail,
    String? batchId,
    String? batchName,
    String? courseId,
    String? courseTitle,
    String? certificateId,
    String? verificationCode,
    String? certificateName,
    DateTime? requestedAt,
    String? status,
    int? completionPercentage,
    String? approvedBy,
    DateTime? approvedAt,
    DateTime? issuedAt,
    DateTime? revokedAt,
    String? revocationReason,
    DateTime? createdAt,
  }) {
    return CertificateOut(
      id: id ?? this.id,
      studentId: studentId ?? this.studentId,
      studentName: studentName ?? this.studentName,
      studentEmail: studentEmail ?? this.studentEmail,
      batchId: batchId ?? this.batchId,
      batchName: batchName ?? this.batchName,
      courseId: courseId ?? this.courseId,
      courseTitle: courseTitle ?? this.courseTitle,
      certificateId: certificateId ?? this.certificateId,
      verificationCode: verificationCode ?? this.verificationCode,
      certificateName: certificateName ?? this.certificateName,
      requestedAt: requestedAt ?? this.requestedAt,
      status: status ?? this.status,
      completionPercentage:
          completionPercentage ?? this.completionPercentage,
      approvedBy: approvedBy ?? this.approvedBy,
      approvedAt: approvedAt ?? this.approvedAt,
      issuedAt: issuedAt ?? this.issuedAt,
      revokedAt: revokedAt ?? this.revokedAt,
      revocationReason: revocationReason ?? this.revocationReason,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  /// Whether the certificate has been approved.
  bool get isApproved => status == 'approved';

  /// Whether the certificate is eligible for request.
  bool get isEligible => status == 'eligible';

  /// Whether the certificate has been revoked.
  bool get isRevoked => status == 'revoked';

  @override
  String toString() =>
      'CertificateOut(id: $id, courseTitle: $courseTitle, status: $status)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CertificateOut &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;
}

/// Matches MaterialOut from backend/app/schemas/material.py.
class MaterialOut {
  final String id;
  final String batchId;
  final String? courseId;
  final String title;
  final String? description;
  final String fileName;
  final String fileType;
  final String? fileSize;
  final int? fileSizeBytes;
  final DateTime? uploadDate;
  final String? uploadedBy;
  final String? uploadedByName;
  final String? uploadedByRole;
  final DateTime? createdAt;

  const MaterialOut({
    required this.id,
    required this.batchId,
    this.courseId,
    required this.title,
    this.description,
    required this.fileName,
    required this.fileType,
    this.fileSize,
    this.fileSizeBytes,
    this.uploadDate,
    this.uploadedBy,
    this.uploadedByName,
    this.uploadedByRole,
    this.createdAt,
  });

  factory MaterialOut.fromJson(Map<String, dynamic> json) {
    return MaterialOut(
      id: json['id']?.toString() ?? '',
      batchId: json['batchId']?.toString() ?? '',
      courseId: json['courseId']?.toString(),
      title: json['title'] as String? ?? '',
      description: json['description'] as String?,
      fileName: json['fileName'] as String? ?? '',
      fileType: json['fileType'] as String? ?? 'other',
      fileSize: json['fileSize'] as String?,
      fileSizeBytes: json['fileSizeBytes'] as int?,
      uploadDate: DateTime.tryParse(json['uploadDate']?.toString() ?? ''),
      uploadedBy: json['uploadedBy']?.toString(),
      uploadedByName: json['uploadedByName'] as String?,
      uploadedByRole: json['uploadedByRole'] as String?,
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'batchId': batchId,
      'courseId': courseId,
      'title': title,
      'description': description,
      'fileName': fileName,
      'fileType': fileType,
      'fileSize': fileSize,
      'fileSizeBytes': fileSizeBytes,
      'uploadDate': uploadDate?.toIso8601String(),
      'uploadedBy': uploadedBy,
      'uploadedByName': uploadedByName,
      'uploadedByRole': uploadedByRole,
      'createdAt': createdAt?.toIso8601String(),
    };
  }

  MaterialOut copyWith({
    String? id,
    String? batchId,
    String? courseId,
    String? title,
    String? description,
    String? fileName,
    String? fileType,
    String? fileSize,
    int? fileSizeBytes,
    DateTime? uploadDate,
    String? uploadedBy,
    String? uploadedByName,
    String? uploadedByRole,
    DateTime? createdAt,
  }) {
    return MaterialOut(
      id: id ?? this.id,
      batchId: batchId ?? this.batchId,
      courseId: courseId ?? this.courseId,
      title: title ?? this.title,
      description: description ?? this.description,
      fileName: fileName ?? this.fileName,
      fileType: fileType ?? this.fileType,
      fileSize: fileSize ?? this.fileSize,
      fileSizeBytes: fileSizeBytes ?? this.fileSizeBytes,
      uploadDate: uploadDate ?? this.uploadDate,
      uploadedBy: uploadedBy ?? this.uploadedBy,
      uploadedByName: uploadedByName ?? this.uploadedByName,
      uploadedByRole: uploadedByRole ?? this.uploadedByRole,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  String toString() =>
      'MaterialOut(id: $id, title: $title, fileType: $fileType)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MaterialOut &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;
}

/// Matches MaterialDownloadUrlResponse from backend/app/schemas/material.py.
class MaterialDownloadUrl {
  final String downloadUrl;
  final String fileName;

  const MaterialDownloadUrl({
    required this.downloadUrl,
    required this.fileName,
  });

  factory MaterialDownloadUrl.fromJson(Map<String, dynamic> json) {
    return MaterialDownloadUrl(
      downloadUrl: json['downloadUrl'] as String? ?? '',
      fileName: json['fileName'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'downloadUrl': downloadUrl,
      'fileName': fileName,
    };
  }

  @override
  String toString() =>
      'MaterialDownloadUrl(fileName: $fileName, downloadUrl: $downloadUrl)';
}

/// Matches RecordingSignedUrlOut from backend/app/schemas/zoom.py.
class RecordingSignedUrl {
  final String url;
  final String type;

  const RecordingSignedUrl({
    required this.url,
    required this.type,
  });

  factory RecordingSignedUrl.fromJson(Map<String, dynamic> json) {
    return RecordingSignedUrl(
      url: json['url'] as String? ?? '',
      type: json['type'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'url': url,
      'type': type,
    };
  }

  @override
  String toString() => 'RecordingSignedUrl(type: $type, url: $url)';
}

/// Generic signed URL response for lecture video playback.
/// Used by POST /lectures/{id}/signed-url.
class SignedUrlResponse {
  final String url;
  final String? expiresAt;
  final String type;

  const SignedUrlResponse({
    required this.url,
    this.expiresAt,
    required this.type,
  });

  factory SignedUrlResponse.fromJson(Map<String, dynamic> json) {
    return SignedUrlResponse(
      url: json['url'] as String? ?? '',
      expiresAt: json['expiresAt'] as String?,
      type: json['type'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'url': url,
      'expiresAt': expiresAt,
      'type': type,
    };
  }

  /// Whether this is a Bunny Stream embed URL.
  bool get isBunnyEmbed => type == 'bunny' || type == 'embed';

  /// Whether this is a direct video URL.
  bool get isDirect => type == 'direct';

  @override
  String toString() =>
      'SignedUrlResponse(type: $type, url: ${url.length > 50 ? '${url.substring(0, 50)}...' : url})';
}

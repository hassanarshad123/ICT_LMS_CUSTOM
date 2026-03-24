/// Model for the unified search endpoint response.
///
/// Matches GET /search?q=term&limit=N returning
/// {users: [], batches: [], courses: [], announcements: []}.
/// Students don't see users, so we omit that field.
class SearchResult {
  final List<SearchItem> batches;
  final List<SearchItem> courses;
  final List<SearchItem> announcements;

  const SearchResult({
    this.batches = const [],
    this.courses = const [],
    this.announcements = const [],
  });

  factory SearchResult.fromJson(Map<String, dynamic> json) {
    return SearchResult(
      batches: (json['batches'] as List? ?? [])
          .map((e) => SearchItem.fromJson(e as Map<String, dynamic>, 'batch'))
          .toList(),
      courses: (json['courses'] as List? ?? [])
          .map((e) => SearchItem.fromJson(e as Map<String, dynamic>, 'course'))
          .toList(),
      announcements: (json['announcements'] as List? ?? [])
          .map((e) =>
              SearchItem.fromJson(e as Map<String, dynamic>, 'announcement'))
          .toList(),
    );
  }

  bool get isEmpty =>
      batches.isEmpty && courses.isEmpty && announcements.isEmpty;
}

class SearchItem {
  final String id;
  final String title;
  final String type;

  const SearchItem({
    required this.id,
    required this.title,
    required this.type,
  });

  factory SearchItem.fromJson(Map<String, dynamic> json, String type) {
    return SearchItem(
      id: json['id']?.toString() ?? '',
      title: (json['name'] ?? json['title'] ?? '').toString(),
      type: type,
    );
  }
}

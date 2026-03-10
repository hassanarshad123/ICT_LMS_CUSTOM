/// A lightweight institute entry for the onboarding dropdown.
class InstituteItem {
  final String name;
  final String slug;

  const InstituteItem({required this.name, required this.slug});

  factory InstituteItem.fromJson(Map<String, dynamic> json) {
    return InstituteItem(
      name: json['name'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
    );
  }

  @override
  String toString() => '$name ($slug)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is InstituteItem &&
          runtimeType == other.runtimeType &&
          slug == other.slug;

  @override
  int get hashCode => slug.hashCode;
}

extension StringExtensions on String {
  /// Capitalizes the first letter of the string.
  String get capitalize =>
      isEmpty ? '' : '${this[0].toUpperCase()}${substring(1)}';

  /// Returns the initials from a name string.
  /// "John Doe" -> "JD", "Jane" -> "J", "" -> "?"
  String get initials {
    final parts = trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return isNotEmpty ? this[0].toUpperCase() : '?';
  }

  /// Converts snake_case or kebab-case to Title Case.
  /// "full_time" -> "Full Time", "course-creator" -> "Course Creator"
  String get toTitleCase {
    return replaceAll('_', ' ')
        .replaceAll('-', ' ')
        .split(' ')
        .map((word) =>
            word.isEmpty ? '' : '${word[0].toUpperCase()}${word.substring(1)}')
        .join(' ');
  }

  /// Truncates the string to [maxLength] and appends "..." if needed.
  String truncate(int maxLength) {
    if (length <= maxLength) return this;
    return '${substring(0, maxLength)}...';
  }

  /// Returns true if the string is a valid email address.
  bool get isValidEmail {
    return RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(this);
  }

  /// Returns the string with whitespace trimmed and lowered.
  String get normalized => trim().toLowerCase();
}

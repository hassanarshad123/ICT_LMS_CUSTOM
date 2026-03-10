import 'package:intl/intl.dart';

/// Formats as "Mar 10, 2026"
String formatDate(DateTime date) {
  return DateFormat('MMM dd, yyyy').format(date);
}

/// Formats as "Mar 10, 2026 2:30 PM"
String formatDateTime(DateTime date) {
  return DateFormat('MMM dd, yyyy h:mm a').format(date);
}

/// Formats as "2:30 PM"
String formatTime(DateTime date) {
  return DateFormat('h:mm a').format(date);
}

/// Formats as "10 Mar"
String formatShortDate(DateTime date) {
  return DateFormat('dd MMM').format(date);
}

/// Formats as "March 2026"
String formatMonthYear(DateTime date) {
  return DateFormat('MMMM yyyy').format(date);
}

/// Returns relative time string like "5 minutes ago"
String formatRelativeTime(DateTime date) {
  final diff = DateTime.now().difference(date);
  if (diff.inSeconds < 60) return 'just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays < 7) return '${diff.inDays}d ago';
  return DateFormat('MMM dd, yyyy').format(date);
}

/// Returns greeting based on current time of day.
String getGreeting() {
  final hour = DateTime.now().hour;
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/// Formats duration in minutes to a human-readable string.
/// e.g., 90 -> "1h 30m", 45 -> "45m"
String formatDuration(int? minutes) {
  if (minutes == null || minutes <= 0) return '0m';
  final hours = minutes ~/ 60;
  final mins = minutes % 60;
  if (hours > 0 && mins > 0) return '${hours}h ${mins}m';
  if (hours > 0) return '${hours}h';
  return '${mins}m';
}

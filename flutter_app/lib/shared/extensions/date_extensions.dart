import 'package:intl/intl.dart';

extension DateTimeExtensions on DateTime {
  /// Formats as "Mar 10, 2026"
  String get toFormatted => DateFormat('MMM dd, yyyy').format(this);

  /// Returns relative time like "5 minutes ago"
  String get toRelative {
    final diff = DateTime.now().difference(this);
    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return DateFormat('MMM dd, yyyy').format(this);
  }

  /// Formats as "14:30"
  String get toTimeString =>
      '${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}';

  /// Formats as "2:30 PM"
  String get toTime12 => DateFormat('h:mm a').format(this);

  /// Formats as "10 Mar"
  String get toShortDate => DateFormat('dd MMM').format(this);

  /// Formats as "Mar 10, 2026 2:30 PM"
  String get toFullDateTime => DateFormat('MMM dd, yyyy h:mm a').format(this);

  /// Formats as "March 2026"
  String get toMonthYear => DateFormat('MMMM yyyy').format(this);

  /// Returns true if this date is today.
  bool get isToday {
    final now = DateTime.now();
    return year == now.year && month == now.month && day == now.day;
  }

  /// Returns true if this date is tomorrow.
  bool get isTomorrow {
    final tomorrow = DateTime.now().add(const Duration(days: 1));
    return year == tomorrow.year &&
        month == tomorrow.month &&
        day == tomorrow.day;
  }

  /// Returns true if this date is in the past.
  bool get isPast => isBefore(DateTime.now());

  /// Returns true if this date is in the future.
  bool get isFuture => isAfter(DateTime.now());

  /// Formats date range like "Mar 10 - Jun 30, 2026"
  String toDateRange(DateTime endDate) {
    if (year == endDate.year) {
      return '${DateFormat('MMM dd').format(this)} - ${DateFormat('MMM dd, yyyy').format(endDate)}';
    }
    return '$toFormatted - ${endDate.toFormatted}';
  }
}

import 'package:flutter_test/flutter_test.dart';
import 'package:ict_lms_student/core/utils/date_formatter.dart';

void main() {
  group('formatDate', () {
    test('formats date as "MMM dd, yyyy"', () {
      final date = DateTime(2026, 3, 10);
      expect(formatDate(date), 'Mar 10, 2026');
    });

    test('formats January date', () {
      final date = DateTime(2026, 1, 1);
      expect(formatDate(date), 'Jan 01, 2026');
    });

    test('formats December date', () {
      final date = DateTime(2026, 12, 25);
      expect(formatDate(date), 'Dec 25, 2026');
    });
  });

  group('formatDateTime', () {
    test('formats date and time', () {
      final date = DateTime(2026, 3, 10, 14, 30);
      expect(formatDateTime(date), 'Mar 10, 2026 2:30 PM');
    });

    test('formats morning time', () {
      final date = DateTime(2026, 6, 15, 9, 0);
      expect(formatDateTime(date), 'Jun 15, 2026 9:00 AM');
    });

    test('formats midnight', () {
      final date = DateTime(2026, 1, 1, 0, 0);
      expect(formatDateTime(date), 'Jan 01, 2026 12:00 AM');
    });

    test('formats noon', () {
      final date = DateTime(2026, 1, 1, 12, 0);
      expect(formatDateTime(date), 'Jan 01, 2026 12:00 PM');
    });
  });

  group('formatTime', () {
    test('formats as "h:mm a"', () {
      final date = DateTime(2026, 1, 1, 14, 30);
      expect(formatTime(date), '2:30 PM');
    });

    test('formats morning time', () {
      final date = DateTime(2026, 1, 1, 8, 5);
      expect(formatTime(date), '8:05 AM');
    });
  });

  group('formatShortDate', () {
    test('formats as "dd MMM"', () {
      final date = DateTime(2026, 3, 10);
      expect(formatShortDate(date), '10 Mar');
    });

    test('formats single digit day', () {
      final date = DateTime(2026, 1, 5);
      expect(formatShortDate(date), '05 Jan');
    });
  });

  group('formatMonthYear', () {
    test('formats as "MMMM yyyy"', () {
      final date = DateTime(2026, 3, 10);
      expect(formatMonthYear(date), 'March 2026');
    });

    test('formats September', () {
      final date = DateTime(2026, 9, 1);
      expect(formatMonthYear(date), 'September 2026');
    });
  });

  group('formatRelativeTime', () {
    test('returns "just now" for recent time', () {
      final date = DateTime.now().subtract(const Duration(seconds: 10));
      expect(formatRelativeTime(date), 'just now');
    });

    test('returns minutes ago', () {
      final date = DateTime.now().subtract(const Duration(minutes: 5));
      expect(formatRelativeTime(date), '5m ago');
    });

    test('returns hours ago', () {
      final date = DateTime.now().subtract(const Duration(hours: 3));
      expect(formatRelativeTime(date), '3h ago');
    });

    test('returns days ago', () {
      final date = DateTime.now().subtract(const Duration(days: 3));
      expect(formatRelativeTime(date), '3d ago');
    });

    test('returns formatted date for older than 7 days', () {
      final date = DateTime.now().subtract(const Duration(days: 10));
      // Should return "MMM dd, yyyy" format
      final result = formatRelativeTime(date);
      expect(result, isNot(contains('ago')));
      expect(result, contains(',')); // e.g., "Mar 14, 2026"
    });
  });

  group('getGreeting', () {
    test('returns a non-empty string', () {
      final greeting = getGreeting();
      expect(greeting, isNotEmpty);
    });

    test('returns one of the expected greetings', () {
      final greeting = getGreeting();
      expect(
        ['Good morning', 'Good afternoon', 'Good evening'],
        contains(greeting),
      );
    });
  });

  group('formatDuration', () {
    test('returns "0m" for null input', () {
      expect(formatDuration(null), '0m');
    });

    test('returns "0m" for zero minutes', () {
      expect(formatDuration(0), '0m');
    });

    test('returns "0m" for negative minutes', () {
      expect(formatDuration(-5), '0m');
    });

    test('returns minutes only for < 60', () {
      expect(formatDuration(45), '45m');
    });

    test('returns hours only for exact hours', () {
      expect(formatDuration(60), '1h');
      expect(formatDuration(120), '2h');
    });

    test('returns hours and minutes for mixed', () {
      expect(formatDuration(90), '1h 30m');
      expect(formatDuration(150), '2h 30m');
    });

    test('returns "1m" for 1 minute', () {
      expect(formatDuration(1), '1m');
    });

    test('handles large values', () {
      expect(formatDuration(600), '10h');
      expect(formatDuration(601), '10h 1m');
    });
  });
}

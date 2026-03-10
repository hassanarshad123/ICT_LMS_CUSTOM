class ApiConstants {
  ApiConstants._();

  static const String baseUrl = 'https://apiict.zensbot.site/api/v1';
  static const Duration requestTimeout = Duration(seconds: 30);
  static const Duration connectTimeout = Duration(seconds: 15);

  // Auth endpoints
  static const String login = '/auth/login';
  static const String refresh = '/auth/refresh';
  static const String logout = '/auth/logout';
  static const String logoutAll = '/auth/logout-all';
  static const String changePassword = '/auth/change-password';
  static const String me = '/auth/me';

  // Branding (public, no auth)
  static const String branding = '/branding';
  static const String publicInstitutes = '/branding/institutes';

  // Batches
  static const String batches = '/batches';

  // Courses
  static const String courses = '/courses';

  // Lectures
  static const String lectures = '/lectures';

  // Curriculum
  static const String curriculum = '/curriculum';

  // Materials
  static const String materials = '/materials';

  // Zoom / Classes
  static const String zoomClasses = '/zoom/classes';
  static const String zoomRecordings = '/zoom/recordings';

  // Certificates
  static const String certificates = '/certificates';
  static const String certificateDashboard = '/certificates/my-dashboard';
  static const String certificateRequest = '/certificates/request';

  // Jobs
  static const String jobs = '/jobs';
  static const String myApplications = '/jobs/my-applications';

  // Notifications
  static const String notifications = '/notifications';
  static const String unreadCount = '/notifications/unread-count';
  static const String markAllRead = '/notifications/mark-all-read';

  // Announcements
  static const String announcements = '/announcements';

  // Users
  static const String usersMe = '/users/me';

  // Search
  static const String search = '/search';
}

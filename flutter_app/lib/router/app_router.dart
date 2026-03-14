import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../providers/institute_slug_provider.dart';
import '../shell/app_shell.dart';
import '../features/onboarding/screens/institute_slug_screen.dart';
import '../features/auth/screens/login_screen.dart';
import '../features/home/screens/home_screen.dart';
import '../features/courses/screens/courses_list_screen.dart';
import '../features/courses/screens/course_detail_screen.dart';
import '../features/courses/screens/lecture_player_screen.dart';
import '../features/classes/screens/classes_list_screen.dart';
import '../features/classes/screens/recordings_screen.dart';
import '../features/notifications/screens/notifications_screen.dart';
import '../features/profile/screens/profile_screen.dart';
import '../features/profile/screens/edit_profile_screen.dart';
import '../features/profile/screens/change_password_screen.dart';
import '../features/profile/screens/certificates_screen.dart';
import '../features/profile/screens/jobs_screen.dart';
import '../features/profile/screens/job_detail_screen.dart';
import '../features/profile/screens/announcements_screen.dart';
import '../shared/widgets/pdf_viewer_screen.dart';
import '../features/quizzes/screens/quiz_start_screen.dart';
import '../features/quizzes/screens/quiz_taking_screen.dart';
import '../features/quizzes/screens/quiz_results_screen.dart';
import 'route_names.dart';

/// Notifier that triggers GoRouter.refresh() when auth or slug state changes.
///
/// Instead of recreating GoRouter on every state change (which loses navigation
/// state), we create GoRouter once and use refreshListenable to re-evaluate
/// the redirect logic.
class _RouterNotifier extends ChangeNotifier {
  _RouterNotifier(Ref ref) {
    ref.listen(authProvider, (_, __) => notifyListeners());
    ref.listen(instituteSlugProvider, (_, __) => notifyListeners());
  }
}

final _routerNotifierProvider = Provider<_RouterNotifier>((ref) {
  return _RouterNotifier(ref);
});

final routerProvider = Provider<GoRouter>((ref) {
  final notifier = ref.watch(_routerNotifierProvider);

  return GoRouter(
    initialLocation: '/home',
    refreshListenable: notifier,
    redirect: (context, state) {
      final authState = ref.read(authProvider);
      final slug = ref.read(instituteSlugProvider);

      final isOnboarding = state.matchedLocation == '/onboarding';
      final isLogin = state.matchedLocation == '/login';
      final hasSlug = slug != null && slug.isNotEmpty;
      final isAuthenticated = authState.isAuthenticated;

      // Wait for session restore before making redirect decisions
      if (authState.isLoading) return null;

      // No slug -> force onboarding
      if (!hasSlug && !isOnboarding) return '/onboarding';

      // Has slug but not authenticated -> force login (including from onboarding)
      if (hasSlug && !isAuthenticated && !isLogin) {
        return '/login';
      }

      // Authenticated user trying to access login/onboarding -> go home
      if (isAuthenticated && (isLogin || isOnboarding)) return '/home';

      return null; // No redirect
    },
    routes: [
      // Onboarding
      GoRoute(
        path: '/onboarding',
        name: RouteNames.onboarding,
        builder: (context, state) => const InstituteSlugScreen(),
      ),
      // Login
      GoRoute(
        path: '/login',
        name: RouteNames.login,
        builder: (context, state) => const LoginScreen(),
      ),
      // PDF Viewer (standalone, outside shell)
      GoRoute(
        path: '/pdf-viewer',
        name: RouteNames.pdfViewer,
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>? ?? {};
          return PdfViewerScreen(
            filePath: extra['filePath'] as String? ?? '',
            fileName: extra['fileName'] as String? ?? 'Document',
          );
        },
      ),
      // Main shell with bottom nav
      ShellRoute(
        builder: (context, state, child) => AppShell(child: child),
        routes: [
          // Home tab
          GoRoute(
            path: '/home',
            name: RouteNames.home,
            builder: (context, state) => const HomeScreen(),
          ),
          // Courses tab
          GoRoute(
            path: '/courses',
            name: RouteNames.courses,
            builder: (context, state) => const CoursesListScreen(),
            routes: [
              GoRoute(
                path: ':courseId',
                name: RouteNames.courseDetail,
                builder: (context, state) {
                  final courseId = state.pathParameters['courseId']!;
                  return CourseDetailScreen(courseId: courseId);
                },
                routes: [
                  GoRoute(
                    path: 'lecture/:lectureId',
                    name: RouteNames.lecturePlayer,
                    builder: (context, state) {
                      final lectureId = state.pathParameters['lectureId']!;
                      return LecturePlayerScreen(lectureId: lectureId);
                    },
                  ),
                  GoRoute(
                    path: 'quiz/:quizId',
                    name: RouteNames.quizStart,
                    builder: (context, state) {
                      final courseId = state.pathParameters['courseId']!;
                      final quizId = state.pathParameters['quizId']!;
                      return QuizStartScreen(courseId: courseId, quizId: quizId);
                    },
                    routes: [
                      GoRoute(
                        path: 'take',
                        name: RouteNames.quizTaking,
                        builder: (context, state) {
                          final courseId = state.pathParameters['courseId']!;
                          final quizId = state.pathParameters['quizId']!;
                          return QuizTakingScreen(courseId: courseId, quizId: quizId);
                        },
                      ),
                      GoRoute(
                        path: 'results/:attemptId',
                        name: RouteNames.quizResults,
                        builder: (context, state) {
                          final quizId = state.pathParameters['quizId']!;
                          final attemptId = state.pathParameters['attemptId']!;
                          return QuizResultsScreen(quizId: quizId, attemptId: attemptId);
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
          // Classes tab
          GoRoute(
            path: '/classes',
            name: RouteNames.classes,
            builder: (context, state) => const ClassesListScreen(),
            routes: [
              GoRoute(
                path: 'recordings',
                name: RouteNames.recordings,
                builder: (context, state) => const RecordingsScreen(),
              ),
            ],
          ),
          // Notifications tab
          GoRoute(
            path: '/notifications',
            name: RouteNames.notifications,
            builder: (context, state) => const NotificationsScreen(),
          ),
          // Profile tab
          GoRoute(
            path: '/profile',
            name: RouteNames.profile,
            builder: (context, state) => const ProfileScreen(),
            routes: [
              GoRoute(
                path: 'edit',
                name: RouteNames.editProfile,
                builder: (context, state) => const EditProfileScreen(),
              ),
              GoRoute(
                path: 'change-password',
                name: RouteNames.changePassword,
                builder: (context, state) => const ChangePasswordScreen(),
              ),
              GoRoute(
                path: 'certificates',
                name: RouteNames.certificates,
                builder: (context, state) => const CertificatesScreen(),
              ),
              GoRoute(
                path: 'jobs',
                name: RouteNames.jobs,
                builder: (context, state) => const JobsScreen(),
                routes: [
                  GoRoute(
                    path: ':jobId',
                    name: RouteNames.jobDetail,
                    builder: (context, state) {
                      final jobId = state.pathParameters['jobId']!;
                      return JobDetailScreen(jobId: jobId);
                    },
                  ),
                ],
              ),
              GoRoute(
                path: 'announcements',
                name: RouteNames.announcements,
                builder: (context, state) => const AnnouncementsScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});

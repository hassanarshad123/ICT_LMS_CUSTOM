import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/constants/app_animations.dart';
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
import '../features/profile/screens/settings_screen.dart';
import '../features/auth/screens/verify_email_screen.dart';
import '../features/auth/screens/reset_password_screen.dart';
import '../shared/widgets/pdf_viewer_screen.dart';
import '../features/quizzes/screens/quiz_start_screen.dart';
import '../features/quizzes/screens/quiz_taking_screen.dart';
import '../features/quizzes/screens/quiz_results_screen.dart';
import 'route_names.dart';

// ---------------------------------------------------------------------------
// Transition builders
// ---------------------------------------------------------------------------

/// iOS-style slide from right + fade for detail screens.
CustomTransitionPage<void> _slideTransition({
  required LocalKey key,
  required Widget child,
}) {
  return CustomTransitionPage<void>(
    key: key,
    child: child,
    transitionDuration: AppAnimations.normal,
    reverseTransitionDuration: AppAnimations.normal,
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final slide = Tween<Offset>(
        begin: const Offset(1, 0),
        end: Offset.zero,
      ).animate(CurvedAnimation(
        parent: animation,
        curve: AppAnimations.curveEnter,
      ));
      final fade = CurvedAnimation(
        parent: animation,
        curve: AppAnimations.curveEnter,
      );
      return SlideTransition(
        position: slide,
        child: FadeTransition(opacity: fade, child: child),
      );
    },
  );
}

/// Cross-fade for tab switches within the shell.
CustomTransitionPage<void> _fadeTransition({
  required LocalKey key,
  required Widget child,
}) {
  return CustomTransitionPage<void>(
    key: key,
    child: child,
    transitionDuration: AppAnimations.tabFade,
    reverseTransitionDuration: AppAnimations.tabFade,
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      return FadeTransition(
        opacity: CurvedAnimation(
          parent: animation,
          curve: AppAnimations.curveEnter,
        ),
        child: child,
      );
    },
  );
}

/// Fade + scale for modal screens (login, onboarding).
CustomTransitionPage<void> _modalTransition({
  required LocalKey key,
  required Widget child,
}) {
  return CustomTransitionPage<void>(
    key: key,
    child: child,
    transitionDuration: AppAnimations.normal,
    reverseTransitionDuration: AppAnimations.normal,
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final fade = CurvedAnimation(
        parent: animation,
        curve: AppAnimations.curveEnter,
      );
      final scale = Tween<double>(begin: 0.95, end: 1.0).animate(fade);
      return FadeTransition(
        opacity: fade,
        child: ScaleTransition(scale: scale, child: child),
      );
    },
  );
}

// ---------------------------------------------------------------------------
// Router notifier
// ---------------------------------------------------------------------------

/// Notifier that triggers GoRouter.refresh() when auth or slug state changes.
class _RouterNotifier extends ChangeNotifier {
  _RouterNotifier(Ref ref) {
    ref.listen(authProvider, (_, __) => notifyListeners());
    ref.listen(instituteSlugProvider, (_, __) => notifyListeners());
  }
}

final _routerNotifierProvider = Provider<_RouterNotifier>((ref) {
  return _RouterNotifier(ref);
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

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
      // Onboarding — modal fade+scale
      GoRoute(
        path: '/onboarding',
        name: RouteNames.onboarding,
        pageBuilder: (context, state) => _modalTransition(
          key: state.pageKey,
          child: const InstituteSlugScreen(),
        ),
      ),
      // Login — modal fade+scale
      GoRoute(
        path: '/login',
        name: RouteNames.login,
        pageBuilder: (context, state) => _modalTransition(
          key: state.pageKey,
          child: const LoginScreen(),
        ),
      ),
      // PDF Viewer (standalone, outside shell) — slide
      GoRoute(
        path: '/pdf-viewer',
        name: RouteNames.pdfViewer,
        pageBuilder: (context, state) {
          final extra = state.extra as Map<String, dynamic>? ?? {};
          return _slideTransition(
            key: state.pageKey,
            child: PdfViewerScreen(
              filePath: extra['filePath'] as String? ?? '',
              fileName: extra['fileName'] as String? ?? 'Document',
            ),
          );
        },
      ),
      // Main shell with bottom nav
      ShellRoute(
        builder: (context, state, child) => AppShell(child: child),
        routes: [
          // Home tab — cross-fade
          GoRoute(
            path: '/home',
            name: RouteNames.home,
            pageBuilder: (context, state) => _fadeTransition(
              key: state.pageKey,
              child: const HomeScreen(),
            ),
          ),
          // Courses tab — cross-fade, children slide
          GoRoute(
            path: '/courses',
            name: RouteNames.courses,
            pageBuilder: (context, state) => _fadeTransition(
              key: state.pageKey,
              child: const CoursesListScreen(),
            ),
            routes: [
              GoRoute(
                path: ':courseId',
                name: RouteNames.courseDetail,
                pageBuilder: (context, state) {
                  final courseId = state.pathParameters['courseId']!;
                  return _slideTransition(
                    key: state.pageKey,
                    child: CourseDetailScreen(courseId: courseId),
                  );
                },
                routes: [
                  GoRoute(
                    path: 'lecture/:lectureId',
                    name: RouteNames.lecturePlayer,
                    pageBuilder: (context, state) {
                      final lectureId = state.pathParameters['lectureId']!;
                      return _slideTransition(
                        key: state.pageKey,
                        child: LecturePlayerScreen(lectureId: lectureId),
                      );
                    },
                  ),
                  GoRoute(
                    path: 'quiz/:quizId',
                    name: RouteNames.quizStart,
                    pageBuilder: (context, state) {
                      final courseId = state.pathParameters['courseId']!;
                      final quizId = state.pathParameters['quizId']!;
                      return _slideTransition(
                        key: state.pageKey,
                        child: QuizStartScreen(courseId: courseId, quizId: quizId),
                      );
                    },
                    routes: [
                      GoRoute(
                        path: 'take',
                        name: RouteNames.quizTaking,
                        pageBuilder: (context, state) {
                          final courseId = state.pathParameters['courseId']!;
                          final quizId = state.pathParameters['quizId']!;
                          return _slideTransition(
                            key: state.pageKey,
                            child: QuizTakingScreen(courseId: courseId, quizId: quizId),
                          );
                        },
                      ),
                      GoRoute(
                        path: 'results/:attemptId',
                        name: RouteNames.quizResults,
                        pageBuilder: (context, state) {
                          final quizId = state.pathParameters['quizId']!;
                          final attemptId = state.pathParameters['attemptId']!;
                          return _slideTransition(
                            key: state.pageKey,
                            child: QuizResultsScreen(quizId: quizId, attemptId: attemptId),
                          );
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
          // Classes tab — cross-fade, children slide
          GoRoute(
            path: '/classes',
            name: RouteNames.classes,
            pageBuilder: (context, state) => _fadeTransition(
              key: state.pageKey,
              child: const ClassesListScreen(),
            ),
            routes: [
              GoRoute(
                path: 'recordings',
                name: RouteNames.recordings,
                pageBuilder: (context, state) => _slideTransition(
                  key: state.pageKey,
                  child: const RecordingsScreen(),
                ),
              ),
            ],
          ),
          // Notifications tab — cross-fade
          GoRoute(
            path: '/notifications',
            name: RouteNames.notifications,
            pageBuilder: (context, state) => _fadeTransition(
              key: state.pageKey,
              child: const NotificationsScreen(),
            ),
          ),
          // Profile tab — cross-fade, children slide
          GoRoute(
            path: '/profile',
            name: RouteNames.profile,
            pageBuilder: (context, state) => _fadeTransition(
              key: state.pageKey,
              child: const ProfileScreen(),
            ),
            routes: [
              GoRoute(
                path: 'edit',
                name: RouteNames.editProfile,
                pageBuilder: (context, state) => _slideTransition(
                  key: state.pageKey,
                  child: const EditProfileScreen(),
                ),
              ),
              GoRoute(
                path: 'change-password',
                name: RouteNames.changePassword,
                pageBuilder: (context, state) => _slideTransition(
                  key: state.pageKey,
                  child: const ChangePasswordScreen(),
                ),
              ),
              GoRoute(
                path: 'certificates',
                name: RouteNames.certificates,
                pageBuilder: (context, state) => _slideTransition(
                  key: state.pageKey,
                  child: const CertificatesScreen(),
                ),
              ),
              GoRoute(
                path: 'jobs',
                name: RouteNames.jobs,
                pageBuilder: (context, state) => _slideTransition(
                  key: state.pageKey,
                  child: const JobsScreen(),
                ),
                routes: [
                  GoRoute(
                    path: ':jobId',
                    name: RouteNames.jobDetail,
                    pageBuilder: (context, state) {
                      final jobId = state.pathParameters['jobId']!;
                      return _slideTransition(
                        key: state.pageKey,
                        child: JobDetailScreen(jobId: jobId),
                      );
                    },
                  ),
                ],
              ),
              GoRoute(
                path: 'announcements',
                name: RouteNames.announcements,
                pageBuilder: (context, state) => _slideTransition(
                  key: state.pageKey,
                  child: const AnnouncementsScreen(),
                ),
              ),
              GoRoute(
                path: 'settings',
                pageBuilder: (context, state) => _slideTransition(
                  key: state.pageKey,
                  child: const SettingsScreen(),
                ),
              ),
            ],
          ),
        ],
      ),

      // Auth routes (accessible before login, for deep links)
      GoRoute(
        path: '/verify-email',
        pageBuilder: (context, state) => _modalTransition(
          key: state.pageKey,
          child: VerifyEmailScreen(token: state.uri.queryParameters['token']),
        ),
      ),
      GoRoute(
        path: '/reset-password',
        pageBuilder: (context, state) => _modalTransition(
          key: state.pageKey,
          child: ResetPasswordScreen(token: state.uri.queryParameters['token']),
        ),
      ),
    ],
  );
});

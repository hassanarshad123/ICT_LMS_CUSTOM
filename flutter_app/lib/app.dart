import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/app_theme.dart';
import 'providers/auth_provider.dart';
import 'providers/branding_provider.dart';
import 'router/app_router.dart';

class App extends ConsumerStatefulWidget {
  const App({super.key});

  @override
  ConsumerState<App> createState() => _AppState();
}

class _AppState extends ConsumerState<App> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // Re-validate session when app returns to foreground.
      // Catches: account deactivated, password changed, batch removed.
      final auth = ref.read(authProvider);
      if (auth.isAuthenticated) {
        ref.read(authProvider.notifier).refreshUser();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final branding = ref.watch(brandingProvider);
    final router = ref.watch(routerProvider);

    // Listen for institute suspension/expiry and show alert dialog
    ref.listen<AuthState>(authProvider, (prev, next) {
      final reason = next.suspensionReason;
      if (reason != null && reason.isNotEmpty) {
        ref.read(authProvider.notifier).clearSuspensionReason();
        final ctx = router.routerDelegate.navigatorKey.currentContext;
        if (ctx != null) {
          showDialog(
            context: ctx,
            barrierDismissible: false,
            builder: (_) => AlertDialog(
              title: const Text('Access Suspended'),
              content: Text(reason),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text('OK'),
                ),
              ],
            ),
          );
        }
      }
    });

    return MaterialApp.router(
      title: branding.instituteName ?? 'Zensbot LMS',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(branding.accentColor),
      routerConfig: router,
    );
  }
}

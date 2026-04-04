import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/app_theme.dart';
import 'providers/auth_provider.dart';
import 'providers/branding_provider.dart';
import 'router/app_router.dart';

final _navigatorKey = GlobalKey<NavigatorState>();

class App extends ConsumerWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final branding = ref.watch(brandingProvider);
    final router = ref.watch(routerProvider);

    // Listen for institute suspension/expiry and show alert dialog
    ref.listen<AuthState>(authProvider, (prev, next) {
      final reason = next.suspensionReason;
      if (reason != null && reason.isNotEmpty) {
        // Clear immediately so dialog doesn't re-trigger on rebuild
        ref.read(authProvider.notifier).clearSuspensionReason();
        // Show dialog using the router's navigator
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

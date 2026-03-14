import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/app_theme.dart';
import 'providers/branding_provider.dart';
import 'router/app_router.dart';

class App extends ConsumerWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final branding = ref.watch(brandingProvider);
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: branding.instituteName ?? 'Zensbot LMS',
      debugShowCheckedModeBanner: false,
      theme: buildDarkTheme(branding.accentColor),
      routerConfig: router,
    );
  }
}

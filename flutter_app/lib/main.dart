import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'app.dart';
import 'core/services/crash_reporting_service.dart';

/// Global SharedPreferences provider — overridden in main() with the real instance.
final sharedPreferencesProvider = Provider<SharedPreferences>((ref) {
  throw UnimplementedError('Must be overridden in main');
});

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final results = await Future.wait([
    SharedPreferences.getInstance(),
    LiquidGlassWidgets.initialize(),
  ]);
  final prefs = results[0] as SharedPreferences;

  // Initialize Sentry crash reporting (wraps runApp for error capture).
  // Pass SENTRY_DSN via --dart-define=SENTRY_DSN=https://...@sentry.io/...
  await CrashReportingService.init(() {
    runApp(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
        ],
        child: const App(),
      ),
    );
  });
}

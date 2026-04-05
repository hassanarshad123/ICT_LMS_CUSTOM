import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class FullscreenNotifier extends StateNotifier<bool> {
  FullscreenNotifier() : super(false);

  void enterFullscreen() {
    if (state) return;
    state = true;

    SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);

    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  }

  void exitFullscreen() {
    if (!state) return;
    state = false;

    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
    ]);

    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  }

  @override
  void dispose() {
    if (state) {
      SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    }
    super.dispose();
  }
}

final fullscreenProvider =
    StateNotifierProvider<FullscreenNotifier, bool>((ref) {
  return FullscreenNotifier();
});

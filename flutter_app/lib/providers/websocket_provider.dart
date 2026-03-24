import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/network/websocket_service.dart';
import '../core/storage/secure_storage.dart';
import 'auth_provider.dart';

final websocketServiceProvider = Provider<WebSocketService>((ref) {
  final service = WebSocketService();

  // Auto-connect when auth state becomes authenticated
  ref.listen<AuthState>(authProvider, (previous, next) async {
    if (next.isAuthenticated && next.user != null) {
      final secureStorage = SecureStorageService();
      final token = await secureStorage.getAccessToken();
      if (token != null) {
        service.connectAnnouncements(next.user!.id, token);
      }
    } else if (previous?.isAuthenticated == true && !next.isAuthenticated) {
      service.dispose();
    }
  });

  ref.onDispose(() => service.dispose());

  return service;
});

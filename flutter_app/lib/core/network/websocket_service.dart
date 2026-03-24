import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../constants/api_constants.dart';

/// Manages WebSocket connections for real-time updates.
class WebSocketService {
  WebSocketChannel? _announcementChannel;
  Timer? _reconnectTimer;
  bool _disposed = false;

  final _announcementController = StreamController<Map<String, dynamic>>.broadcast();

  Stream<Map<String, dynamic>> get announcementStream => _announcementController.stream;

  Future<void> connectAnnouncements(String userId, String token) async {
    _disposeChannel();

    try {
      final uri = Uri.parse(
        '${ApiConstants.wsBaseUrl}/announcements/$userId?token=$token',
      );
      _announcementChannel = WebSocketChannel.connect(uri);

      _announcementChannel!.stream.listen(
        (message) {
          try {
            final data = jsonDecode(message as String) as Map<String, dynamic>;
            _announcementController.add(data);
          } catch (e) {
            if (kDebugMode) debugPrint('[WebSocket] Parse error: $e');
          }
        },
        onError: (error) {
          if (kDebugMode) debugPrint('[WebSocket] Error: $error');
          _scheduleReconnect(userId, token);
        },
        onDone: () {
          if (!_disposed) {
            _scheduleReconnect(userId, token);
          }
        },
      );
    } catch (e) {
      if (kDebugMode) debugPrint('[WebSocket] Connect error: $e');
      _scheduleReconnect(userId, token);
    }
  }

  void _scheduleReconnect(String userId, String token) {
    _reconnectTimer?.cancel();
    if (_disposed) return;
    _reconnectTimer = Timer(const Duration(seconds: 5), () {
      connectAnnouncements(userId, token);
    });
  }

  void _disposeChannel() {
    _announcementChannel?.sink.close();
    _announcementChannel = null;
  }

  void dispose() {
    _disposed = true;
    _reconnectTimer?.cancel();
    _disposeChannel();
    _announcementController.close();
  }
}

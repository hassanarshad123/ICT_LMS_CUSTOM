import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../constants/api_constants.dart';

/// Manages WebSocket connections for real-time updates.
class WebSocketService {
  WebSocketChannel? _announcementChannel;
  Timer? _reconnectTimer;
  bool _disposed = false;
  int _reconnectAttempts = 0;
  static const int _maxReconnectDelay = 60;

  final _announcementController = StreamController<Map<String, dynamic>>.broadcast();

  Stream<Map<String, dynamic>> get announcementStream => _announcementController.stream;

  Future<void> connectAnnouncements(String userId, String token) async {
    _disposeChannel();

    try {
      final uri = Uri.parse(
        '${ApiConstants.wsBaseUrl}/announcements/$userId?token=$token',
      );
      _announcementChannel = WebSocketChannel.connect(uri);

      _reconnectAttempts = 0; // Reset on successful connection
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
    // Exponential backoff: 2^attempts seconds, capped at 60s
    final delay = math.min(
      math.pow(2, _reconnectAttempts).toInt(),
      _maxReconnectDelay,
    );
    _reconnectAttempts++;
    _reconnectTimer = Timer(Duration(seconds: delay), () {
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

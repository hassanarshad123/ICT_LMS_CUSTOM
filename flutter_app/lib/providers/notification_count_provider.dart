import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/constants/api_constants.dart';
import '../core/network/api_client.dart';
import 'auth_provider.dart';

/// Manages the unread notification count displayed on the bottom nav badge.
///
/// Polls the backend every 60 seconds when the user is authenticated.
/// The count is refreshed on-demand via [refresh()] after marking
/// notifications as read.
class NotificationCountNotifier extends StateNotifier<int> {
  final Dio _dio;
  final Ref _ref;
  Timer? _pollTimer;

  NotificationCountNotifier(this._dio, this._ref) : super(0) {
    _startPolling();
  }

  void _startPolling() {
    // Fetch immediately on creation
    refresh();
    // Then poll every 60 seconds
    _pollTimer = Timer.periodic(
      const Duration(seconds: 60),
      (_) => _fetchIfAuthenticated(),
    );
  }

  void _fetchIfAuthenticated() {
    final authState = _ref.read(authProvider);
    if (authState.isAuthenticated) {
      refresh();
    }
  }

  /// Fetch the current unread notification count from the backend.
  Future<void> refresh() async {
    try {
      final response = await _dio.get(ApiConstants.unreadCount);
      final data = response.data as Map<String, dynamic>;
      final count = data['count'] as int? ?? data['unreadCount'] as int? ?? 0;
      if (mounted) {
        state = count;
      }
    } catch (_) {
      // Silently fail -- keep current count
    }
  }

  /// Reset count to zero locally (e.g., after marking all as read).
  void reset() {
    if (mounted) {
      state = 0;
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _pollTimer = null;
    super.dispose();
  }
}

final notificationCountProvider =
    StateNotifierProvider<NotificationCountNotifier, int>((ref) {
  final dio = ref.watch(dioProvider);
  return NotificationCountNotifier(dio, ref);
});

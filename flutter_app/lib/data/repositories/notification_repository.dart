import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/core/constants/api_constants.dart';
import 'package:ict_lms_student/core/network/api_client.dart';
import 'package:ict_lms_student/models/notification_out.dart';

class NotificationRepository {
  final Dio _dio;

  NotificationRepository(this._dio);

  /// GET /notifications
  Future<Map<String, dynamic>> listNotifications({
    int page = 1,
    int perPage = 20,
  }) async {
    final response = await _dio.get(
      ApiConstants.notifications,
      queryParameters: {
        'page': page,
        'per_page': perPage,
      },
    );

    final data = response.data as Map<String, dynamic>;
    final items = (data['data'] as List<dynamic>?)
            ?.map(
                (e) => NotificationOut.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];

    return {
      'data': items,
      'total': data['total'] as int? ?? 0,
      'page': data['page'] as int? ?? 1,
      'perPage': data['perPage'] as int? ?? perPage,
      'totalPages': data['totalPages'] as int? ?? 0,
    };
  }

  /// GET /notifications/unread-count
  Future<int> getUnreadCount() async {
    final response = await _dio.get(ApiConstants.unreadCount);
    final data = response.data as Map<String, dynamic>;
    return data['count'] as int? ?? 0;
  }

  /// PATCH /notifications/{notificationId}/read
  Future<NotificationOut> markAsRead(String notificationId) async {
    final response =
        await _dio.patch('${ApiConstants.notifications}/$notificationId/read');
    return NotificationOut.fromJson(response.data as Map<String, dynamic>);
  }

  /// POST /notifications/mark-all-read
  Future<int> markAllRead() async {
    final response = await _dio.post(ApiConstants.markAllRead);
    final data = response.data as Map<String, dynamic>;
    return data['marked'] as int? ?? 0;
  }
}

final notificationRepositoryProvider = Provider<NotificationRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return NotificationRepository(dio);
});

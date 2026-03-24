import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/core/constants/api_constants.dart';
import 'package:ict_lms_student/core/network/api_client.dart';
import 'package:ict_lms_student/models/notification_out.dart';
import 'package:ict_lms_student/models/paginated_response.dart';

class NotificationRepository {
  final Dio _dio;

  NotificationRepository(this._dio);

  /// GET /notifications
  Future<PaginatedResponse<NotificationOut>> listNotifications({
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

    return PaginatedResponse.fromJson(
      response.data as Map<String, dynamic>,
      (json) => NotificationOut.fromJson(json),
    );
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

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/core/constants/api_constants.dart';
import 'package:ict_lms_student/core/network/api_client.dart';

class UserRepository {
  final Dio _dio;

  UserRepository(this._dio);

  /// PATCH /users/me — self-update: only name and phone.
  Future<Map<String, dynamic>> updateMe({
    String? name,
    String? phone,
  }) async {
    final data = <String, dynamic>{};
    if (name != null) data['name'] = name;
    if (phone != null) data['phone'] = phone;

    final response = await _dio.patch(
      ApiConstants.usersMe,
      data: data,
    );

    return response.data as Map<String, dynamic>;
  }
}

final userRepositoryProvider = Provider<UserRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return UserRepository(dio);
});

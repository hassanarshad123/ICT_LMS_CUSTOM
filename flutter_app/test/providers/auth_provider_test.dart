import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:ict_lms_student/data/repositories/auth_repository.dart';
import 'package:ict_lms_student/core/storage/secure_storage.dart';
import 'package:ict_lms_student/core/storage/local_storage.dart';
import 'package:ict_lms_student/models/auth_user.dart';
import 'package:ict_lms_student/models/login_response.dart';
import 'package:ict_lms_student/providers/auth_provider.dart';
import 'package:dio/dio.dart';

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

/// Fake [AuthRepository] that returns preset responses or throws errors.
class FakeAuthRepository extends AuthRepository {
  LoginResponse? loginResult;
  AuthUser? getMeResult;
  Exception? loginError;
  Exception? getMeError;
  String? lastLogoutRefreshToken;
  bool logoutCalled = false;

  FakeAuthRepository() : super(_unusedDio());

  @override
  Future<LoginResponse> login(
    String email,
    String password, {
    String? deviceInfo,
  }) async {
    if (loginError != null) throw loginError!;
    return loginResult!;
  }

  @override
  Future<AuthUser> getMe() async {
    if (getMeError != null) throw getMeError!;
    return getMeResult!;
  }

  @override
  Future<void> logout(String refreshToken) async {
    logoutCalled = true;
    lastLogoutRefreshToken = refreshToken;
  }
}

Dio _unusedDio() => Dio();

/// Fake [SecureStorageService] backed by an in-memory map.
///
/// Overrides every method so the real [FlutterSecureStorage] is never touched.
class FakeSecureStorageService extends SecureStorageService {
  final Map<String, String> _store = {};

  FakeSecureStorageService() : super(null);

  @override
  Future<String?> getAccessToken() async => _store['access_token'];

  @override
  Future<void> setAccessToken(String token) async =>
      _store['access_token'] = token;

  @override
  Future<String?> getRefreshToken() async => _store['refresh_token'];

  @override
  Future<void> setRefreshToken(String token) async =>
      _store['refresh_token'] = token;

  @override
  Future<String?> getUserJson() async => _store['user_json'];

  @override
  Future<void> setUserJson(String json) async => _store['user_json'] = json;

  @override
  Future<void> clearUserJson() async => _store.remove('user_json');

  @override
  Future<void> clearTokens() async {
    _store.remove('access_token');
    _store.remove('refresh_token');
  }

  @override
  Future<void> clearAuth() async {
    await clearTokens();
    await clearUserJson();
  }

  @override
  Future<void> clearAll() async => _store.clear();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

AuthUser _makeUser({String id = 'user-001', String email = 'test@test.com'}) {
  return AuthUser(
    id: id,
    email: email,
    name: 'Test User',
    role: 'student',
    status: 'active',
  );
}

/// Builds a fake JWT with the given [exp] (seconds since epoch).
String _buildFakeJwt(int exp) {
  final header = base64Url.encode(utf8.encode('{"alg":"HS256","typ":"JWT"}'));
  final payload = base64Url.encode(
    utf8.encode(jsonEncode({'exp': exp, 'sub': 'user-001'})),
  );
  return '$header.$payload.fake-signature';
}

String get _validToken =>
    _buildFakeJwt(DateTime(2100, 1, 1).millisecondsSinceEpoch ~/ 1000);

String get _expiredToken =>
    _buildFakeJwt(DateTime(2000, 1, 1).millisecondsSinceEpoch ~/ 1000);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void main() {
  group('AuthState', () {
    test('default state is loading with no user', () {
      const state = AuthState();
      expect(state.user, isNull);
      expect(state.isAuthenticated, false);
      expect(state.isLoading, true);
      expect(state.error, isNull);
    });

    test('convenience getters return defaults when user is null', () {
      const state = AuthState();
      expect(state.userId, '');
      expect(state.userName, '');
      expect(state.userEmail, '');
      expect(state.userRole, 'student');
      expect(state.userAvatarUrl, isNull);
      expect(state.userBatchIds, isEmpty);
      expect(state.userBatchNames, isEmpty);
    });

    test('convenience getters return user properties', () {
      final user = AuthUser(
        id: 'user-001',
        email: 'a@b.com',
        name: 'Alice',
        role: 'admin',
        avatarUrl: 'https://avatar.url',
        batchIds: ['b1'],
        batchNames: ['Batch 1'],
      );
      final state = AuthState(user: user, isAuthenticated: true);

      expect(state.userId, 'user-001');
      expect(state.userName, 'Alice');
      expect(state.userEmail, 'a@b.com');
      expect(state.userRole, 'admin');
      expect(state.userAvatarUrl, 'https://avatar.url');
      expect(state.userBatchIds, ['b1']);
      expect(state.userBatchNames, ['Batch 1']);
    });

    test('copyWith clears error when not provided', () {
      const state = AuthState(error: 'Some error');
      final updated = state.copyWith(isLoading: false);
      // copyWith sets error to the passed value (null by default).
      expect(updated.error, isNull);
    });

    test('copyWith preserves other fields', () {
      final user = _makeUser();
      final state = AuthState(
        user: user,
        isAuthenticated: true,
        isLoading: false,
      );
      final updated = state.copyWith(isLoading: true);

      expect(updated.user, user);
      expect(updated.isAuthenticated, true);
      expect(updated.isLoading, true);
    });
  });

  group('AuthNotifier', () {
    late FakeAuthRepository fakeRepo;
    late FakeSecureStorageService fakeSecureStorage;
    late LocalStorageService fakeLocalStorage;

    setUp(() async {
      fakeRepo = FakeAuthRepository();
      fakeSecureStorage = FakeSecureStorageService();
      // Use SharedPreferences test helper to create a real instance
      // backed by in-memory storage.
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      fakeLocalStorage = LocalStorageService(prefs);
    });

    AuthNotifier createNotifier() {
      return AuthNotifier(
        repo: fakeRepo,
        secureStorage: fakeSecureStorage,
        localStorage: fakeLocalStorage,
      );
    }

    test('initial state is loading with no user', () {
      final notifier = createNotifier();
      expect(notifier.state.isLoading, true);
      expect(notifier.state.user, isNull);
      expect(notifier.state.isAuthenticated, false);
    });

    group('restoreSession', () {
      test('sets unauthenticated when no token exists', () async {
        final notifier = createNotifier();
        await notifier.restoreSession();

        expect(notifier.state.isAuthenticated, false);
        expect(notifier.state.isLoading, false);
        expect(notifier.state.user, isNull);
      });

      test('restores session from cached user and validates via getMe',
          () async {
        final user = _makeUser();
        await fakeSecureStorage.setAccessToken(_validToken);
        await fakeSecureStorage.setRefreshToken(_validToken);
        await fakeSecureStorage.setUserJson(jsonEncode(user.toJson()));

        fakeRepo.getMeResult = user;

        final notifier = createNotifier();
        await notifier.restoreSession();

        expect(notifier.state.isAuthenticated, true);
        expect(notifier.state.isLoading, false);
        expect(notifier.state.user, equals(user));
      });

      test('clears auth when getMe fails', () async {
        await fakeSecureStorage.setAccessToken(_validToken);
        await fakeSecureStorage.setRefreshToken(_validToken);

        fakeRepo.getMeError = Exception('Unauthorized');

        final notifier = createNotifier();
        await notifier.restoreSession();

        expect(notifier.state.isAuthenticated, false);
        expect(notifier.state.isLoading, false);
        expect(notifier.state.user, isNull);
        expect(await fakeSecureStorage.getAccessToken(), isNull);
      });

      test('clears auth when both tokens are expired', () async {
        await fakeSecureStorage.setAccessToken(_expiredToken);
        await fakeSecureStorage.setRefreshToken(_expiredToken);

        final notifier = createNotifier();
        await notifier.restoreSession();

        expect(notifier.state.isAuthenticated, false);
        expect(notifier.state.isLoading, false);
      });
    });

    group('logout', () {
      test('clears state and storage', () async {
        await fakeSecureStorage.setAccessToken('access-token');
        await fakeSecureStorage.setRefreshToken('refresh-token');
        await fakeSecureStorage.setUserJson('{"id":"u1"}');

        final notifier = createNotifier();
        notifier.state = AuthState(
          user: _makeUser(),
          isAuthenticated: true,
          isLoading: false,
        );

        await notifier.logout();

        expect(notifier.state.isAuthenticated, false);
        expect(notifier.state.isLoading, false);
        expect(notifier.state.user, isNull);
        expect(await fakeSecureStorage.getAccessToken(), isNull);
        expect(await fakeSecureStorage.getRefreshToken(), isNull);
        expect(fakeRepo.lastLogoutRefreshToken, 'refresh-token');
      });

      test('clears state even when API logout fails', () async {
        await fakeSecureStorage.setRefreshToken('refresh-token');

        final brokenRepo = _ThrowingLogoutRepo();
        final notifier = AuthNotifier(
          repo: brokenRepo,
          secureStorage: fakeSecureStorage,
          localStorage: fakeLocalStorage,
        );

        notifier.state = AuthState(
          user: _makeUser(),
          isAuthenticated: true,
          isLoading: false,
        );

        // Should not throw
        await notifier.logout();

        expect(notifier.state.isAuthenticated, false);
        expect(notifier.state.isLoading, false);
      });

      test('skips API call when no refresh token stored', () async {
        // No refresh token in storage
        final notifier = createNotifier();
        notifier.state = AuthState(
          user: _makeUser(),
          isAuthenticated: true,
          isLoading: false,
        );

        await notifier.logout();

        expect(notifier.state.isAuthenticated, false);
        expect(fakeRepo.logoutCalled, false);
      });
    });

    group('forceLogout', () {
      test('synchronously clears state', () {
        final notifier = createNotifier();
        notifier.state = AuthState(
          user: _makeUser(),
          isAuthenticated: true,
          isLoading: false,
        );

        notifier.forceLogout();

        expect(notifier.state.isAuthenticated, false);
        expect(notifier.state.isLoading, false);
        expect(notifier.state.user, isNull);
      });
    });

    group('refreshUser', () {
      test('updates user in state', () async {
        final updatedUser = _makeUser(email: 'updated@test.com');
        fakeRepo.getMeResult = updatedUser;

        final notifier = createNotifier();
        notifier.state = AuthState(
          user: _makeUser(),
          isAuthenticated: true,
          isLoading: false,
        );

        await notifier.refreshUser();

        expect(notifier.state.user!.email, 'updated@test.com');
      });

      test('keeps current state on failure', () async {
        final originalUser = _makeUser();
        fakeRepo.getMeError = Exception('Network error');

        final notifier = createNotifier();
        notifier.state = AuthState(
          user: originalUser,
          isAuthenticated: true,
          isLoading: false,
        );

        await notifier.refreshUser();

        expect(notifier.state.user, equals(originalUser));
        expect(notifier.state.isAuthenticated, true);
      });
    });
  });
}

/// Auth repository whose logout always throws.
class _ThrowingLogoutRepo extends AuthRepository {
  _ThrowingLogoutRepo() : super(_unusedDio());

  @override
  Future<void> logout(String refreshToken) async {
    throw Exception('API unavailable');
  }

  @override
  Future<AuthUser> getMe() async => throw UnimplementedError();

  @override
  Future<LoginResponse> login(String email, String password,
          {String? deviceInfo}) async =>
      throw UnimplementedError();
}

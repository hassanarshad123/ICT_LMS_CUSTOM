import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../core/network/api_client.dart';
import '../core/storage/local_storage.dart';
import '../core/storage/secure_storage.dart';
import '../data/repositories/auth_repository.dart';
import '../main.dart';
import '../models/auth_user.dart';

/// Authentication state for the app.
///
/// Holds the current user, authentication status, loading state, and any error.
/// The [user] field is null when not authenticated.
class AuthState {
  final AuthUser? user;
  final bool isAuthenticated;
  final bool isLoading;
  final String? error;
  /// Set when the user is force-logged out due to institute suspension/expiry.
  /// The UI should show this message in a dialog before clearing it.
  final String? suspensionReason;

  const AuthState({
    this.user,
    this.isAuthenticated = false,
    this.isLoading = true,
    this.error,
    this.suspensionReason,
  });

  AuthState copyWith({
    AuthUser? user,
    bool? isAuthenticated,
    bool? isLoading,
    String? error,
    String? suspensionReason,
  }) {
    return AuthState(
      user: user ?? this.user,
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      suspensionReason: suspensionReason,
    );
  }

  /// Convenience getters for user properties.
  String get userId => user?.id ?? '';
  String get userName => user?.name ?? '';
  String get userEmail => user?.email ?? '';
  String get userRole => user?.role ?? 'student';
  String? get userAvatarUrl => user?.avatarUrl;
  List<String> get userBatchIds => user?.batchIds ?? [];
  List<String> get userBatchNames => user?.batchNames ?? [];
}

/// Notifier that manages authentication state.
///
/// Handles login, session restoration, user refresh, logout, and force logout.
/// Stores tokens in SecureStorage and user data in SharedPreferences.
class AuthNotifier extends StateNotifier<AuthState> {
  final AuthRepository _repo;
  final SecureStorageService _secureStorage;
  final LocalStorageService _localStorage;

  AuthNotifier({
    required AuthRepository repo,
    required SecureStorageService secureStorage,
    required LocalStorageService localStorage,
  })  : _repo = repo,
        _secureStorage = secureStorage,
        _localStorage = localStorage,
        super(const AuthState());

  /// Login with email and password.
  ///
  /// On success:
  /// - Stores access token and refresh token in SecureStorage
  /// - Stores user JSON in SharedPreferences (for fast restore)
  /// - Updates state with user and isAuthenticated=true
  ///
  /// On failure:
  /// - Sets error message in state
  /// - Rethrows the exception for the calling screen to handle
  Future<void> login(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _repo.login(
        email,
        password,
        deviceInfo: '${Platform.operatingSystem} ${Platform.operatingSystemVersion}',
      );
      await _secureStorage.setAccessToken(response.accessToken);
      await _secureStorage.setRefreshToken(response.refreshToken);
      await _localStorage.setUserJson(response.user.toJson());
      state = AuthState(
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
      );
    } catch (e) {
      String errorMessage = 'Login failed';
      if (e is DioException) {
        final apiError = e.error;
        if (apiError != null) {
          errorMessage = apiError.toString();
        } else if (e.response?.data is Map) {
          errorMessage =
              (e.response?.data as Map)['detail']?.toString() ?? errorMessage;
        }
      } else {
        errorMessage = e.toString();
      }
      state = state.copyWith(isLoading: false, error: errorMessage);
      rethrow;
    }
  }

  /// Restore session from stored tokens on app startup.
  ///
  /// Flow:
  /// 1. Check if an access token exists in SecureStorage
  /// 2. If no token -> set unauthenticated
  /// 3. If token exists -> try to load cached user from SharedPreferences
  ///    for instant UI, then validate by calling GET /auth/me
  /// 4. If getMe succeeds -> update user and stay authenticated
  /// 5. If getMe fails -> clear all storage and set unauthenticated
  Future<void> restoreSession() async {
    state = state.copyWith(isLoading: true);
    try {
      final token = await _secureStorage.getAccessToken();
      if (token == null) {
        state = const AuthState(isLoading: false);
        return;
      }

      // Try to load cached user for immediate display
      final cachedUserJson = _localStorage.getUserJson();
      if (cachedUserJson != null) {
        final cachedUser = AuthUser.fromJson(cachedUserJson);
        state = AuthState(
          user: cachedUser,
          isAuthenticated: true,
          isLoading: true,
        );
      }

      // Validate token by calling GET /auth/me
      final user = await _repo.getMe();
      await _localStorage.setUserJson(user.toJson());
      state = AuthState(
        user: user,
        isAuthenticated: true,
        isLoading: false,
      );
    } catch (_) {
      // Token invalid or expired -- clear and show login
      await _secureStorage.clearTokens();
      await _localStorage.clear();
      state = const AuthState(isLoading: false);
    }
  }

  /// Refresh user data from the API.
  ///
  /// Called when returning to the app or after profile updates.
  /// Silently fails -- keeps the current user state on error.
  Future<void> refreshUser() async {
    try {
      final user = await _repo.getMe();
      await _localStorage.setUserJson(user.toJson());
      state = state.copyWith(user: user);
    } catch (_) {
      // Ignore -- keep current state
    }
  }

  /// Logout: call the logout API, then clear all local storage and state.
  ///
  /// Even if the API call fails (e.g., network error), local state
  /// is still cleared so the user can re-login.
  Future<void> logout() async {
    try {
      final refreshToken = await _secureStorage.getRefreshToken();
      if (refreshToken != null) {
        await _repo.logout(refreshToken);
      }
    } catch (_) {
      // Ignore logout API errors -- still clear local state
    } finally {
      await _secureStorage.clearTokens();
      await _localStorage.clear();
      state = const AuthState(isLoading: false);
    }
  }

  /// Force logout without calling the API.
  ///
  /// Called by the AuthInterceptor when a token refresh fails,
  /// indicating the session is irrecoverably expired.
  void forceLogout([String? reason]) {
    _secureStorage.clearTokens();
    _localStorage.clear();
    state = AuthState(isLoading: false, suspensionReason: reason);
  }

  /// Clear the suspension reason after the UI has shown the dialog.
  void clearSuspensionReason() {
    state = state.copyWith(suspensionReason: null);
  }
}

/// Provider for auth state.
///
/// Creates the AuthNotifier with all required dependencies
/// (repository, secure storage, local storage).
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final prefs = ref.watch(sharedPreferencesProvider);
  const secureStorage = FlutterSecureStorage();
  final secureStorageService = SecureStorageService(secureStorage);
  final localStorageService = LocalStorageService(prefs);

  // Create a Dio with all interceptors for the auth repository.
  // The forceLogout callback will be connected to this notifier.
  late final AuthNotifier notifier;

  final dio = createAuthenticatedDio(
    prefs: prefs,
    secureStorage: secureStorage,
    onForceLogout: ([String? reason]) {
      notifier.forceLogout(reason);
    },
  );

  final repo = AuthRepository(dio);

  notifier = AuthNotifier(
    repo: repo,
    secureStorage: secureStorageService,
    localStorage: localStorageService,
  );

  // Kick off session restoration so users don't have to re-login on every restart
  notifier.restoreSession();

  return notifier;
});

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/repositories/branding_repository.dart';
import '../../../models/institute_item.dart';
import '../../../providers/branding_provider.dart';
import '../../../providers/institute_slug_provider.dart';

/// State for the onboarding (institute selection) flow.
class OnboardingState {
  final bool isValidating;
  final bool isLoadingInstitutes;
  final List<InstituteItem> institutes;
  final InstituteItem? selectedInstitute;
  final String? error;

  const OnboardingState({
    this.isValidating = false,
    this.isLoadingInstitutes = false,
    this.institutes = const [],
    this.selectedInstitute,
    this.error,
  });

  OnboardingState copyWith({
    bool? isValidating,
    bool? isLoadingInstitutes,
    List<InstituteItem>? institutes,
    InstituteItem? selectedInstitute,
    bool clearSelectedInstitute = false,
    String? error,
  }) {
    return OnboardingState(
      isValidating: isValidating ?? this.isValidating,
      isLoadingInstitutes: isLoadingInstitutes ?? this.isLoadingInstitutes,
      institutes: institutes ?? this.institutes,
      selectedInstitute: clearSelectedInstitute
          ? null
          : (selectedInstitute ?? this.selectedInstitute),
      error: error,
    );
  }
}

/// Notifier that loads institutes and validates selection by fetching branding.
class OnboardingNotifier extends StateNotifier<OnboardingState> {
  final Ref _ref;

  OnboardingNotifier(this._ref) : super(const OnboardingState()) {
    loadInstitutes();
  }

  /// Fetch the list of active institutes from the public endpoint.
  Future<void> loadInstitutes() async {
    state = state.copyWith(isLoadingInstitutes: true, error: null);
    try {
      final repo = _ref.read(brandingRepositoryProvider);
      final institutes = await repo.getInstitutes();
      state = state.copyWith(
        isLoadingInstitutes: false,
        institutes: institutes,
      );
    } catch (e) {
      state = state.copyWith(
        isLoadingInstitutes: false,
        error: 'Could not load institutes: ${e.toString()}',
      );
    }
  }

  /// Select an institute from the dropdown.
  void selectInstitute(InstituteItem? institute) {
    state = state.copyWith(
      selectedInstitute: institute,
      clearSelectedInstitute: institute == null,
      error: null,
    );
  }

  /// Validate the selected institute by persisting slug and fetching branding.
  Future<bool> validateSlug(String slug) async {
    if (slug.trim().isEmpty) {
      state = state.copyWith(
        isValidating: false,
        error: 'Please select an institute',
      );
      return false;
    }

    state = state.copyWith(isValidating: true, error: null);

    try {
      // Step 1: Persist slug to prefs (interceptor uses it), but DON'T update state.
      await _ref.read(instituteSlugProvider.notifier).persistSlug(slug);

      // Step 2: Fetch branding (interceptor reads slug from prefs)
      final success =
          await _ref.read(brandingProvider.notifier).fetchBranding();

      if (success) {
        // Step 3: NOW commit to state (triggers router redirect to /login)
        _ref.read(instituteSlugProvider.notifier).commitSlug();
        state = state.copyWith(isValidating: false);
        return true;
      } else {
        final brandingError = _ref.read(brandingProvider).error;
        await _ref.read(instituteSlugProvider.notifier).clearSlug();
        state = state.copyWith(
          isValidating: false,
          error: brandingError ?? 'Could not verify institute. Please try again.',
        );
        return false;
      }
    } catch (e) {
      await _ref.read(instituteSlugProvider.notifier).clearSlug();
      state = state.copyWith(
        isValidating: false,
        error: 'Connection error: ${e.toString()}',
      );
      return false;
    }
  }

  void clearError() {
    state = state.copyWith(error: null);
  }
}

/// Provider for the onboarding flow.
final onboardingProvider =
    StateNotifierProvider.autoDispose<OnboardingNotifier, OnboardingState>(
        (ref) {
  return OnboardingNotifier(ref);
});

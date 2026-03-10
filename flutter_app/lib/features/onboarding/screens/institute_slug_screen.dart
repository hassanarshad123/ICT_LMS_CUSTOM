import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../models/institute_item.dart';
import '../../../providers/branding_provider.dart';
import '../providers/onboarding_provider.dart';

/// Onboarding screen where the user selects their institute from a dropdown.
class InstituteSlugScreen extends ConsumerStatefulWidget {
  const InstituteSlugScreen({super.key});

  @override
  ConsumerState<InstituteSlugScreen> createState() =>
      _InstituteSlugScreenState();
}

class _InstituteSlugScreenState extends ConsumerState<InstituteSlugScreen> {
  Future<void> _onContinue() async {
    final selected = ref.read(onboardingProvider).selectedInstitute;
    if (selected == null) {
      ref.read(onboardingProvider.notifier).selectInstitute(null);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Please select an institute'),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.all(16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
        ),
      );
      return;
    }

    final success = await ref
        .read(onboardingProvider.notifier)
        .validateSlug(selected.slug);

    if (!mounted) return;

    if (!success) {
      final error = ref.read(onboardingProvider).error;
      if (error != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error),
            backgroundColor: AppColors.error,
            behavior: SnackBarBehavior.floating,
            margin: const EdgeInsets.all(16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final onboardingState = ref.watch(onboardingProvider);
    final branding = ref.watch(brandingProvider);
    final accentColor = branding.accentColor;
    final isBusy = onboardingState.isValidating;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Institute logo placeholder icon
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: accentColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Icon(
                    Icons.school_rounded,
                    size: 40,
                    color: accentColor,
                  ),
                ),
                const SizedBox(height: 32),

                // Title
                Text(
                  'Select your institute',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),

                // Subtitle
                Text(
                  'Choose your institute to continue',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 40),

                // Institute dropdown or loading state
                if (onboardingState.isLoadingInstitutes)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: CircularProgressIndicator(),
                  )
                else if (onboardingState.institutes.isEmpty)
                  _buildEmptyState(accentColor)
                else
                  _buildDropdown(onboardingState, accentColor),

                const SizedBox(height: 24),

                // Continue button
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    onPressed: isBusy ||
                            onboardingState.isLoadingInstitutes ||
                            onboardingState.institutes.isEmpty
                        ? null
                        : _onContinue,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: accentColor,
                      foregroundColor: AppColors.scaffoldBg,
                      disabledBackgroundColor:
                          accentColor.withValues(alpha: 0.5),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: isBusy
                        ? const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.5,
                              color: AppColors.scaffoldBg,
                            ),
                          )
                        : const Text(
                            'Continue',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                  ),
                ),
                const SizedBox(height: 48),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDropdown(OnboardingState onboardingState, Color accentColor) {
    return DropdownButtonFormField<InstituteItem>(
      initialValue: onboardingState.selectedInstitute,
      isExpanded: true,
      dropdownColor: AppColors.cardBg,
      style: const TextStyle(
        color: AppColors.textPrimary,
        fontSize: 16,
      ),
      decoration: InputDecoration(
        hintText: 'Select an institute',
        hintStyle: const TextStyle(color: AppColors.textTertiary),
        prefixIcon: const Icon(
          Icons.business_rounded,
          color: AppColors.textTertiary,
        ),
        filled: true,
        fillColor: AppColors.inputBg,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: accentColor, width: 1.5),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      items: onboardingState.institutes.map((institute) {
        return DropdownMenuItem<InstituteItem>(
          value: institute,
          child: Text(
            institute.name,
            style: const TextStyle(color: AppColors.textPrimary),
          ),
        );
      }).toList(),
      onChanged: (value) {
        ref.read(onboardingProvider.notifier).selectInstitute(value);
      },
    );
  }

  Widget _buildEmptyState(Color accentColor) {
    return Column(
      children: [
        Icon(
          Icons.wifi_off_rounded,
          size: 48,
          color: AppColors.textTertiary,
        ),
        const SizedBox(height: 12),
        const Text(
          'Could not load institutes',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
        ),
        const SizedBox(height: 12),
        TextButton.icon(
          onPressed: () {
            ref.read(onboardingProvider.notifier).loadInstitutes();
          },
          icon: const Icon(Icons.refresh_rounded, size: 18),
          label: const Text('Retry'),
          style: TextButton.styleFrom(foregroundColor: accentColor),
        ),
      ],
    );
  }
}

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_animations.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/responsive.dart';
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
    AppAnimations.hapticMedium();
    final selected = ref.read(onboardingProvider).selectedInstitute;
    if (selected == null) {
      ref.read(onboardingProvider.notifier).selectInstitute(null);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Please select an institute'),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.all(AppSpacing.screenH),
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
            margin: const EdgeInsets.all(AppSpacing.screenH),
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
      backgroundColor: AppColors.scaffoldBg,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: EdgeInsets.symmetric(
              horizontal: Responsive.isCompact(context) ? AppSpacing.space32 : AppSpacing.space48,
            ),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const SizedBox(height: AppSpacing.space48),

                // App icon
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
                )
                    .animate()
                    .fadeIn(duration: AppAnimations.slow, curve: AppAnimations.curveEnter)
                    .scale(
                      begin: const Offset(0.8, 0.8),
                      end: const Offset(1.0, 1.0),
                      duration: AppAnimations.slow,
                      curve: AppAnimations.curveEnter,
                    ),
                const SizedBox(height: AppSpacing.space32),

                // Welcome title
                Text(
                  'Welcome',
                  style: AppTextStyles.largeTitle,
                  textAlign: TextAlign.center,
                )
                    .animate(delay: 50.ms)
                    .fadeIn(duration: AppAnimations.normal, curve: AppAnimations.curveEnter)
                    .slideY(
                      begin: 0.1,
                      end: 0,
                      duration: AppAnimations.normal,
                      curve: AppAnimations.curveEnter,
                    ),
                const SizedBox(height: AppSpacing.space8),

                // Subtitle
                Text(
                  'Select your institute to continue',
                  style: AppTextStyles.subheadline,
                  textAlign: TextAlign.center,
                )
                    .animate(delay: 100.ms)
                    .fadeIn(duration: AppAnimations.normal, curve: AppAnimations.curveEnter)
                    .slideY(
                      begin: 0.1,
                      end: 0,
                      duration: AppAnimations.normal,
                      curve: AppAnimations.curveEnter,
                    ),
                const SizedBox(height: AppSpacing.space40),

                // Institute dropdown or loading state
                if (onboardingState.isLoadingInstitutes)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: AppSpacing.space16),
                    child: CupertinoActivityIndicator(radius: 14),
                  )
                else if (onboardingState.institutes.isEmpty)
                  _buildEmptyState(accentColor)
                      .animate(delay: 150.ms)
                      .fadeIn(duration: AppAnimations.normal, curve: AppAnimations.curveEnter)
                      .slideY(
                        begin: 0.1,
                        end: 0,
                        duration: AppAnimations.normal,
                        curve: AppAnimations.curveEnter,
                      )
                else
                  _buildDropdown(onboardingState, accentColor)
                      .animate(delay: 150.ms)
                      .fadeIn(duration: AppAnimations.normal, curve: AppAnimations.curveEnter)
                      .slideY(
                        begin: 0.1,
                        end: 0,
                        duration: AppAnimations.normal,
                        curve: AppAnimations.curveEnter,
                      ),

                // Error text
                if (onboardingState.error != null) ...[
                  const SizedBox(height: AppSpacing.space8),
                  Text(
                    onboardingState.error!,
                    style: AppTextStyles.footnote.copyWith(
                      color: AppColors.error,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],

                const SizedBox(height: AppSpacing.space24),

                // Continue button
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    onPressed: isBusy ||
                            onboardingState.isLoadingInstitutes ||
                            onboardingState.institutes.isEmpty
                        ? null
                        : _onContinue,
                    child: isBusy
                        ? const CupertinoActivityIndicator(
                            color: Colors.white,
                          )
                        : Text(
                            'Continue',
                            style: AppTextStyles.bodyMedium.copyWith(
                              color: Colors.white,
                            ),
                          ),
                  ),
                )
                    .animate(delay: 200.ms)
                    .fadeIn(duration: AppAnimations.normal, curve: AppAnimations.curveEnter)
                    .slideY(
                      begin: 0.1,
                      end: 0,
                      duration: AppAnimations.normal,
                      curve: AppAnimations.curveEnter,
                    ),
                const SizedBox(height: AppSpacing.space48),
              ],
            ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDropdown(OnboardingState onboardingState, Color accentColor) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(AppSpacing.inputRadius),
        border: Border.all(color: AppColors.border),
      ),
      child: DropdownButtonFormField<InstituteItem>(
        value: onboardingState.selectedInstitute,
        isExpanded: true,
        dropdownColor: AppColors.cardBg,
        style: AppTextStyles.body,
        icon: const Icon(
          Icons.keyboard_arrow_down_rounded,
          color: AppColors.textTertiary,
        ),
        decoration: InputDecoration(
          hintText: 'Select an institute',
          hintStyle: AppTextStyles.body.copyWith(
            color: AppColors.textTertiary,
          ),
          prefixIcon: const Icon(
            Icons.business_rounded,
            color: AppColors.textTertiary,
          ),
          filled: true,
          fillColor: AppColors.cardBg,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppSpacing.inputRadius),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppSpacing.inputRadius),
            borderSide: BorderSide.none,
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppSpacing.inputRadius),
            borderSide: BorderSide.none,
          ),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.space16,
            vertical: 14,
          ),
        ),
        items: onboardingState.institutes.map((institute) {
          return DropdownMenuItem<InstituteItem>(
            value: institute,
            child: Text(
              institute.name,
              style: AppTextStyles.body,
            ),
          );
        }).toList(),
        onChanged: (value) {
          ref.read(onboardingProvider.notifier).selectInstitute(value);
        },
      ),
    );
  }

  Widget _buildEmptyState(Color accentColor) {
    return Column(
      children: [
        const Icon(
          Icons.wifi_off_rounded,
          size: 48,
          color: AppColors.textTertiary,
        ),
        const SizedBox(height: AppSpacing.space12),
        Text(
          'Could not load institutes',
          style: AppTextStyles.subheadline,
        ),
        const SizedBox(height: AppSpacing.space12),
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

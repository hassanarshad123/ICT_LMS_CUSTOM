import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_animations.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_client.dart';
import '../../../data/repositories/auth_repository.dart';

/// Forgot password screen where the user enters their email to receive a
/// password reset link.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _onSubmit() async {
    if (!_formKey.currentState!.validate()) return;
    AppAnimations.hapticMedium();

    // Dismiss keyboard
    FocusScope.of(context).unfocus();

    setState(() => _isSubmitting = true);

    try {
      final publicDio = ref.read(publicDioProvider);
      final authRepo = AuthRepository(publicDio);
      await authRepo.forgotPassword(_emailController.text.trim());

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(
            "If an account exists with this email, you'll receive a reset link",
          ),
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.all(AppSpacing.screenH),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
          duration: const Duration(seconds: 4),
        ),
      );

      // Pop back to login screen
      if (mounted) {
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (!mounted) return;

      String errorMessage = 'Something went wrong. Please try again.';
      if (e is DioException && e.error is ApiException) {
        errorMessage = (e.error as ApiException).message;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(errorMessage),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.all(AppSpacing.screenH),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
          duration: const Duration(seconds: 4),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        title: const Text('Forgot Password'),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding:
                const EdgeInsets.symmetric(horizontal: AppSpacing.space32),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Icon
                  Container(
                    width: 64,
                    height: 64,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: AppColors.textTertiary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(
                      Icons.lock_reset_rounded,
                      size: 32,
                      color: AppColors.textTertiary,
                    ),
                  ).animate().fadeIn(duration: AppAnimations.slow, curve: AppAnimations.curveEnter).scale(begin: const Offset(0.8, 0.8), end: const Offset(1, 1), duration: AppAnimations.slow, curve: AppAnimations.curveEnter),
                  const SizedBox(height: AppSpacing.space24),

                  // Title
                  Text(
                    'Reset Password',
                    style: AppTextStyles.title2,
                    textAlign: TextAlign.center,
                  ).animate(delay: 100.ms).fadeIn(duration: AppAnimations.normal, curve: AppAnimations.curveEnter).slideY(begin: 0.1, end: 0, duration: AppAnimations.normal, curve: AppAnimations.curveEnter),
                  const SizedBox(height: AppSpacing.space8),

                  // Description
                  Text(
                    'Enter your email address and we\'ll send you a link to reset your password.',
                    style: AppTextStyles.subheadline,
                    textAlign: TextAlign.center,
                  ).animate(delay: 150.ms).fadeIn(duration: AppAnimations.normal, curve: AppAnimations.curveEnter).slideY(begin: 0.1, end: 0, duration: AppAnimations.normal, curve: AppAnimations.curveEnter),
                  const SizedBox(height: AppSpacing.space32),

                  // Email field
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.done,
                    autocorrect: false,
                    enableSuggestions: true,
                    decoration: const InputDecoration(
                      hintText: 'Email address',
                      prefixIcon: Icon(
                        Icons.email_outlined,
                        color: AppColors.textTertiary,
                      ),
                    ),
                    style: AppTextStyles.body,
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please enter your email';
                      }
                      if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
                          .hasMatch(value.trim())) {
                        return 'Please enter a valid email';
                      }
                      return null;
                    },
                    onFieldSubmitted: (_) => _onSubmit(),
                  ).animate(delay: 200.ms).fadeIn(duration: AppAnimations.normal, curve: AppAnimations.curveEnter).slideY(begin: 0.1, end: 0, duration: AppAnimations.normal, curve: AppAnimations.curveEnter),
                  const SizedBox(height: AppSpacing.space24),

                  // Submit button
                  SizedBox(
                    height: 50,
                    child: ElevatedButton(
                      onPressed: _isSubmitting ? null : _onSubmit,
                      child: AnimatedSwitcher(
                          duration: AppAnimations.fast,
                          child: _isSubmitting
                              ? const SizedBox(
                                  key: ValueKey('loading'),
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : Text(
                                  'Send Reset Link',
                                  key: const ValueKey('text'),
                                  style: AppTextStyles.bodyMedium.copyWith(
                                    color: Colors.white,
                                  ),
                                ),
                        ),
                    ),
                  ).animate(delay: 300.ms).fadeIn(duration: AppAnimations.normal, curve: AppAnimations.curveEnter).slideY(begin: 0.1, end: 0, duration: AppAnimations.normal, curve: AppAnimations.curveEnter),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

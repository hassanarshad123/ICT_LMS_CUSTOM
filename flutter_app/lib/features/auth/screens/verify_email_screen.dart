import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/data/repositories/auth_repository.dart';

/// Screen for verifying email address via token (from deep link or browser).
class VerifyEmailScreen extends ConsumerStatefulWidget {
  final String? token;

  const VerifyEmailScreen({super.key, this.token});

  @override
  ConsumerState<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends ConsumerState<VerifyEmailScreen> {
  bool _loading = false;
  String? _error;
  bool _success = false;

  @override
  void initState() {
    super.initState();
    if (widget.token != null && widget.token!.isNotEmpty) {
      _verifyEmail();
    }
  }

  Future<void> _verifyEmail() async {
    setState(() { _loading = true; _error = null; });
    try {
      final repo = ref.read(authRepositoryProvider);
      await repo.verifyEmail(widget.token!);
      setState(() { _success = true; _loading = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        title: const Text('Email Verification'),
        backgroundColor: AppColors.cardBg,
        surfaceTintColor: Colors.transparent,
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.space24),
          child: _loading
              ? const CircularProgressIndicator()
              : _success
                  ? Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.check_circle, color: AppColors.success, size: 64),
                        const SizedBox(height: AppSpacing.space16),
                        Text('Email Verified!', style: AppTextStyles.headline),
                        const SizedBox(height: AppSpacing.space8),
                        Text(
                          'Your email has been verified successfully.',
                          style: AppTextStyles.subheadline,
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: AppSpacing.space24),
                        ElevatedButton(
                          onPressed: () => context.go('/login'),
                          child: const Text('Continue to Login'),
                        ),
                      ],
                    )
                  : _error != null
                      ? Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.error_outline, color: AppColors.error, size: 64),
                            const SizedBox(height: AppSpacing.space16),
                            Text('Verification Failed', style: AppTextStyles.headline),
                            const SizedBox(height: AppSpacing.space8),
                            Text(
                              _error!.contains('expired')
                                  ? 'This verification link has expired. Please request a new one.'
                                  : 'Invalid verification link. Please try again.',
                              style: AppTextStyles.subheadline,
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: AppSpacing.space24),
                            TextButton(
                              onPressed: () => context.go('/login'),
                              child: const Text('Back to Login'),
                            ),
                          ],
                        )
                      : Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.email_outlined, color: AppColors.textTertiary, size: 64),
                            const SizedBox(height: AppSpacing.space16),
                            Text('No verification token provided.', style: AppTextStyles.subheadline),
                            const SizedBox(height: AppSpacing.space24),
                            TextButton(
                              onPressed: () => context.go('/login'),
                              child: const Text('Back to Login'),
                            ),
                          ],
                        ),
        ),
      ),
    );
  }
}

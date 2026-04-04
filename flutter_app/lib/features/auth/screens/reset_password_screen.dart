import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/data/repositories/auth_repository.dart';

/// Screen for resetting password via token (from deep link or browser).
class ResetPasswordScreen extends ConsumerStatefulWidget {
  final String? token;

  const ResetPasswordScreen({super.key, this.token});

  @override
  ConsumerState<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends ConsumerState<ResetPasswordScreen> {
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _loading = false;
  String? _error;
  bool _success = false;
  bool _obscure = true;

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _resetPassword() async {
    final password = _passwordController.text.trim();
    final confirm = _confirmController.text.trim();

    if (password.isEmpty) {
      setState(() => _error = 'Please enter a new password');
      return;
    }
    if (password.length < 8) {
      setState(() => _error = 'Password must be at least 8 characters');
      return;
    }
    if (password != confirm) {
      setState(() => _error = 'Passwords do not match');
      return;
    }

    setState(() { _loading = true; _error = null; });
    try {
      final repo = ref.read(authRepositoryProvider);
      await repo.resetPassword(widget.token!, password);
      setState(() { _success = true; _loading = false; });
      // Auto-redirect to login after 3 seconds
      Future.delayed(const Duration(seconds: 3), () {
        if (mounted) context.go('/login');
      });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.token == null || widget.token!.isEmpty) {
      return Scaffold(
        backgroundColor: AppColors.scaffoldBg,
        appBar: AppBar(title: const Text('Reset Password')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.link_off, color: AppColors.textTertiary, size: 64),
              const SizedBox(height: AppSpacing.space16),
              Text('No reset token provided.', style: AppTextStyles.subheadline),
              const SizedBox(height: AppSpacing.space24),
              TextButton(
                onPressed: () => context.go('/login'),
                child: const Text('Back to Login'),
              ),
            ],
          ),
        ),
      );
    }

    if (_success) {
      return Scaffold(
        backgroundColor: AppColors.scaffoldBg,
        appBar: AppBar(title: const Text('Reset Password')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.space24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.check_circle, color: AppColors.success, size: 64),
                const SizedBox(height: AppSpacing.space16),
                Text('Password Reset!', style: AppTextStyles.headline),
                const SizedBox(height: AppSpacing.space8),
                Text(
                  'Your password has been changed. You can now log in with your new password.',
                  style: AppTextStyles.subheadline,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.space24),
                ElevatedButton(
                  onPressed: () => context.go('/login'),
                  child: const Text('Go to Login'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        title: const Text('Reset Password'),
        backgroundColor: AppColors.cardBg,
        surfaceTintColor: Colors.transparent,
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.space24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 400),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.lock_reset, color: AppColors.textTertiary, size: 48),
                const SizedBox(height: AppSpacing.space16),
                Text('Set New Password', style: AppTextStyles.headline, textAlign: TextAlign.center),
                const SizedBox(height: AppSpacing.space8),
                Text(
                  'Enter your new password below.',
                  style: AppTextStyles.subheadline,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.space24),
                TextField(
                  controller: _passwordController,
                  obscureText: _obscure,
                  decoration: InputDecoration(
                    labelText: 'New Password',
                    hintText: 'Minimum 8 characters',
                    suffixIcon: IconButton(
                      icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility),
                      onPressed: () => setState(() => _obscure = !_obscure),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.space12),
                TextField(
                  controller: _confirmController,
                  obscureText: _obscure,
                  decoration: const InputDecoration(
                    labelText: 'Confirm Password',
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: AppSpacing.space12),
                  Text(
                    _error!,
                    style: const TextStyle(color: AppColors.error, fontSize: 13),
                    textAlign: TextAlign.center,
                  ),
                ],
                const SizedBox(height: AppSpacing.space24),
                ElevatedButton(
                  onPressed: _loading ? null : _resetPassword,
                  child: _loading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Reset Password'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/branding_provider.dart';
import '../../../providers/institute_slug_provider.dart';
import 'forgot_password_screen.dart';

/// Login screen — Apple sign-in style with light theme.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _emailFocusNode = FocusNode();
  final _passwordFocusNode = FocusNode();
  bool _obscurePassword = true;
  bool _isLoggingIn = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _emailFocusNode.dispose();
    _passwordFocusNode.dispose();
    super.dispose();
  }

  Future<void> _onLogin() async {
    if (!_formKey.currentState!.validate()) return;

    // Dismiss keyboard
    FocusScope.of(context).unfocus();

    setState(() => _isLoggingIn = true);

    try {
      await ref.read(authProvider.notifier).login(
            _emailController.text.trim(),
            _passwordController.text,
          );
      // On success, the GoRouter redirect in app_router.dart will
      // automatically navigate to /home because authState.isAuthenticated
      // becomes true.
    } catch (e) {
      if (!mounted) return;

      // Extract a user-friendly error message
      final authState = ref.read(authProvider);
      final errorMessage =
          authState.error ?? 'Login failed. Please try again.';

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
        setState(() => _isLoggingIn = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final branding = ref.watch(brandingProvider);
    final accentColor = branding.accentColor;

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space32),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  const SizedBox(height: AppSpacing.space32),

                  // Institute logo
                  _buildLogo(branding, accentColor),
                  const SizedBox(height: AppSpacing.space20),

                  // Institute name
                  Text(
                    branding.instituteName ?? 'LMS',
                    style: AppTextStyles.title2,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: AppSpacing.space4),

                  // Tagline
                  if (branding.tagline != null &&
                      branding.tagline!.isNotEmpty) ...[
                    Text(
                      branding.tagline!,
                      style: AppTextStyles.subheadline,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: AppSpacing.space40),
                  ] else
                    const SizedBox(height: AppSpacing.space40),

                  // Email field
                  TextFormField(
                    controller: _emailController,
                    focusNode: _emailFocusNode,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
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
                      // Basic email format check
                      if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
                          .hasMatch(value.trim())) {
                        return 'Please enter a valid email';
                      }
                      return null;
                    },
                    onFieldSubmitted: (_) {
                      _passwordFocusNode.requestFocus();
                    },
                  ),
                  const SizedBox(height: AppSpacing.space16),

                  // Password field
                  TextFormField(
                    controller: _passwordController,
                    focusNode: _passwordFocusNode,
                    obscureText: _obscurePassword,
                    textInputAction: TextInputAction.done,
                    decoration: InputDecoration(
                      hintText: 'Password',
                      prefixIcon: const Icon(
                        Icons.lock_outline_rounded,
                        color: AppColors.textTertiary,
                      ),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                          color: AppColors.textTertiary,
                        ),
                        onPressed: () {
                          setState(() {
                            _obscurePassword = !_obscurePassword;
                          });
                        },
                      ),
                    ),
                    style: AppTextStyles.body,
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please enter your password';
                      }
                      return null;
                    },
                    onFieldSubmitted: (_) => _onLogin(),
                  ),
                  const SizedBox(height: AppSpacing.space32),

                  // Sign In button
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed: _isLoggingIn ? null : _onLogin,
                      child: _isLoggingIn
                          ? const CupertinoActivityIndicator(
                              color: Colors.white,
                            )
                          : Text(
                              'Sign In',
                              style: AppTextStyles.bodyMedium.copyWith(
                                color: Colors.white,
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.space16),

                  // Forgot password link
                  TextButton(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const ForgotPasswordScreen(),
                        ),
                      );
                    },
                    child: Text(
                      'Forgot Password?',
                      style: AppTextStyles.subheadline.copyWith(
                        color: accentColor,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.space32),

                  // Change institute link
                  TextButton(
                    onPressed: () {
                      ref.read(instituteSlugProvider.notifier).clearSlug();
                    },
                    child: Text(
                      'Change Institute',
                      style: AppTextStyles.subheadline.copyWith(
                        color: AppColors.textTertiary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Powered by Zensbot.com',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      color: AppColors.textTertiary,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.space16),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// Build the institute logo widget.
  ///
  /// If a logo URL is available in branding, display it as a network image.
  /// If it's a base64 data URL, display it as a memory image.
  /// Otherwise, show a fallback School icon.
  Widget _buildLogo(BrandingState branding, Color accentColor) {
    final logoUrl = branding.logoUrl;

    if (logoUrl != null && logoUrl.isNotEmpty) {
      // Check if it's a base64 data URL
      if (logoUrl.startsWith('data:image/')) {
        try {
          // Extract base64 part from data URL
          final base64Part = logoUrl.split(',').last;
          final bytes =
              Uri.parse('data:application/octet-stream;base64,$base64Part')
                  .data
                  ?.contentAsBytes();
          if (bytes != null) {
            return Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
              ),
              clipBehavior: Clip.antiAlias,
              child: Image.memory(
                bytes,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => _buildFallbackIcon(accentColor),
              ),
            );
          }
        } catch (_) {
          // Fall through to fallback icon
        }
      }

      // Regular URL
      return Container(
        width: 80,
        height: 80,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
        ),
        clipBehavior: Clip.antiAlias,
        child: CachedNetworkImage(
          imageUrl: logoUrl,
          fit: BoxFit.contain,
          placeholder: (_, __) => _buildFallbackIcon(accentColor),
          errorWidget: (_, __, ___) => _buildFallbackIcon(accentColor),
        ),
      );
    }

    return _buildFallbackIcon(accentColor);
  }

  /// Fallback icon when no logo URL is available.
  Widget _buildFallbackIcon(Color accentColor) {
    return Container(
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
    );
  }
}

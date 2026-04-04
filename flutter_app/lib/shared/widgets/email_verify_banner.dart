import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';

/// Banner prompting unverified students to verify their email address.
///
/// Shows at the top of the home screen when [AuthUser.emailVerified] is false.
/// Includes a "Resend" button that triggers the verification email resend.
class EmailVerifyBanner extends StatefulWidget {
  final String email;
  final Future<void> Function() onResend;

  const EmailVerifyBanner({
    super.key,
    required this.email,
    required this.onResend,
  });

  @override
  State<EmailVerifyBanner> createState() => _EmailVerifyBannerState();
}

class _EmailVerifyBannerState extends State<EmailVerifyBanner> {
  bool _sending = false;
  bool _sent = false;

  Future<void> _handleResend() async {
    setState(() { _sending = true; });
    try {
      await widget.onResend();
      setState(() { _sent = true; });
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to resend. Try again later.')),
        );
      }
    } finally {
      if (mounted) setState(() { _sending = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.amber.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(
            Icons.mark_email_unread_outlined,
            size: 20,
            color: Colors.amber.shade700,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Verify your email',
                  style: TextStyle(
                    color: Colors.amber.shade800,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  _sent
                      ? 'Verification link sent to ${widget.email}'
                      : 'Check your inbox or tap Resend',
                  style: TextStyle(
                    color: Colors.amber.shade700.withValues(alpha: 0.7),
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          if (!_sent)
            TextButton(
              onPressed: _sending ? null : _handleResend,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: _sending
                  ? SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.amber.shade700,
                      ),
                    )
                  : Text(
                      'Resend',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Colors.amber.shade800,
                      ),
                    ),
            ),
        ],
      ),
    );
  }
}

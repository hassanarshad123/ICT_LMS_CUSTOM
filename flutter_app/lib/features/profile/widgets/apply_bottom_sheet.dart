import 'package:flutter/material.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';

class ApplyBottomSheet extends StatefulWidget {
  final String jobTitle;
  final String company;
  final Future<void> Function(String? coverLetter) onApply;

  const ApplyBottomSheet({
    super.key,
    required this.jobTitle,
    required this.company,
    required this.onApply,
  });

  /// Shows the bottom sheet and returns true if application was submitted.
  static Future<bool?> show({
    required BuildContext context,
    required String jobTitle,
    required String company,
    required Future<void> Function(String? coverLetter) onApply,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.cardBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => ApplyBottomSheet(
        jobTitle: jobTitle,
        company: company,
        onApply: onApply,
      ),
    );
  }

  @override
  State<ApplyBottomSheet> createState() => _ApplyBottomSheetState();
}

class _ApplyBottomSheetState extends State<ApplyBottomSheet> {
  final _coverLetterController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void dispose() {
    _coverLetterController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_isSubmitting) return;

    setState(() => _isSubmitting = true);

    try {
      final coverLetter = _coverLetterController.text.trim();
      await widget.onApply(coverLetter.isEmpty ? null : coverLetter);
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e.toString().replaceFirst('Exception: ', ''),
            ),
            backgroundColor: AppColors.error,
          ),
        );
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final accentColor = Theme.of(context).colorScheme.primary;
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: 16 + bottomInset,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle bar.
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.surfaceBg,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 20),
          // Title.
          const Text(
            'Apply for this job',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w700,
              fontSize: 20,
            ),
          ),
          const SizedBox(height: 8),
          // Job info.
          Text(
            '${widget.jobTitle} at ${widget.company}',
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 20),
          // Cover letter input.
          const Text(
            'Cover Letter (optional)',
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _coverLetterController,
            maxLines: 5,
            maxLength: 1000,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 14,
            ),
            decoration: InputDecoration(
              hintText: 'Tell the employer why you are a good fit...',
              hintStyle: const TextStyle(
                color: AppColors.textTertiary,
                fontSize: 14,
              ),
              filled: true,
              fillColor: AppColors.inputBg,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: accentColor, width: 1),
              ),
              contentPadding: const EdgeInsets.all(14),
              counterStyle: const TextStyle(
                color: AppColors.textTertiary,
                fontSize: 11,
              ),
            ),
          ),
          const SizedBox(height: 16),
          // Submit button.
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _isSubmitting ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: accentColor,
                foregroundColor: AppColors.scaffoldBg,
                disabledBackgroundColor: accentColor.withValues(alpha: 0.4),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: _isSubmitting
                  ? SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.scaffoldBg,
                      ),
                    )
                  : const Text(
                      'Submit Application',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

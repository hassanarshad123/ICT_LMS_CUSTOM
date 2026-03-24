import 'package:flutter/material.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/shared/widgets/avatar_widget.dart';

class ProfileHeader extends StatelessWidget {
  final String name;
  final String email;
  final String? phone;
  final String? avatarUrl;
  final String role;
  final List<String> batchNames;
  final VoidCallback? onEditTap;

  const ProfileHeader({
    super.key,
    required this.name,
    required this.email,
    this.phone,
    this.avatarUrl,
    this.role = 'student',
    this.batchNames = const [],
    this.onEditTap,
  });

  @override
  Widget build(BuildContext context) {
    final accentColor = Theme.of(context).colorScheme.primary;

    return Column(
      children: [
        // Avatar.
        AvatarWidget(
          imageUrl: avatarUrl,
          name: name,
          radius: 40,
        ),
        const SizedBox(height: AppSpacing.space16),
        // Name.
        Text(
          name,
          style: AppTextStyles.title3,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.space4),
        // Email.
        Text(
          email,
          style: AppTextStyles.subheadline.copyWith(
            color: AppColors.textSecondary,
          ),
          textAlign: TextAlign.center,
        ),
        // Phone (if available).
        if (phone != null && phone!.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.space4),
          Text(
            phone!,
            style: AppTextStyles.footnote.copyWith(
              color: AppColors.textTertiary,
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.space12),
        // Role badge + batch chips.
        Wrap(
          spacing: 8,
          runSpacing: 6,
          alignment: WrapAlignment.center,
          children: [
            _RoleBadge(role: role, accentColor: accentColor),
            ...batchNames.map(
              (name) => Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.scaffoldBg,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  name,
                  style: AppTextStyles.caption2.copyWith(
                    fontWeight: FontWeight.w500,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _RoleBadge extends StatelessWidget {
  final String role;
  final Color accentColor;

  const _RoleBadge({required this.role, required this.accentColor});

  @override
  Widget build(BuildContext context) {
    final label = switch (role) {
      'student' => 'Student',
      'teacher' => 'Teacher',
      'course_creator' => 'Course Creator',
      'admin' => 'Admin',
      _ => role,
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: accentColor.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: AppTextStyles.caption1.copyWith(
          color: accentColor,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

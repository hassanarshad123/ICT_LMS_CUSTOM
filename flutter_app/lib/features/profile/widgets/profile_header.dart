import 'package:flutter/material.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
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

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          // Avatar.
          AvatarWidget(
            imageUrl: avatarUrl,
            name: name,
            radius: 40,
          ),
          const SizedBox(height: 16),
          // Name.
          Text(
            name,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w700,
              fontSize: 20,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          // Email.
          Text(
            email,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 14,
            ),
            textAlign: TextAlign.center,
          ),
          // Phone (if available).
          if (phone != null && phone!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              phone!,
              style: const TextStyle(
                color: AppColors.textTertiary,
                fontSize: 13,
              ),
            ),
          ],
          const SizedBox(height: 12),
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
                    color: AppColors.surfaceBg,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    name,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ],
          ),
          // Edit profile button.
          if (onEditTap != null) ...[
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: onEditTap,
                icon: const Icon(Icons.edit_outlined, size: 16),
                label: const Text('Edit Profile'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: accentColor,
                  side: BorderSide(color: accentColor.withValues(alpha: 0.4)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
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
        color: accentColor.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: accentColor,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

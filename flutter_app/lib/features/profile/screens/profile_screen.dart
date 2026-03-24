import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_shadows.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/features/profile/widgets/menu_item_tile.dart';
import 'package:ict_lms_student/features/profile/widgets/profile_header.dart';
import 'package:ict_lms_student/providers/auth_provider.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final user = authState.user;

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        title: Text('Profile', style: AppTextStyles.headline),
        backgroundColor: AppColors.cardBg,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.screenH,
          AppSpacing.space20,
          AppSpacing.screenH,
          80,
        ),
        children: [
          // Profile header with avatar, name, email, role, batch badges.
          ProfileHeader(
            name: user?.name ?? '',
            email: user?.email ?? '',
            phone: user?.phone,
            avatarUrl: user?.avatarUrl,
            role: user?.role ?? 'student',
            batchNames: user?.batchNames ?? [],
          ),
          const SizedBox(height: AppSpacing.space32),
          // Section 1: Account.
          _SectionLabel(title: 'ACCOUNT'),
          const SizedBox(height: AppSpacing.space8),
          Container(
            decoration: BoxDecoration(
              color: AppColors.cardBg,
              borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
              boxShadow: AppShadows.sm,
            ),
            child: Column(
              children: [
                MenuItemTile(
                  icon: Icons.person_outline,
                  title: 'Edit Profile',
                  onTap: () => context.push('/profile/edit'),
                ),
                const Divider(
                    color: AppColors.border, height: 1, indent: 56),
                MenuItemTile(
                  icon: Icons.lock_outline,
                  title: 'Change Password',
                  onTap: () => context.push('/profile/change-password'),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.space24),
          // Section 2: Explore.
          _SectionLabel(title: 'EXPLORE'),
          const SizedBox(height: AppSpacing.space8),
          Container(
            decoration: BoxDecoration(
              color: AppColors.cardBg,
              borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
              boxShadow: AppShadows.sm,
            ),
            child: Column(
              children: [
                MenuItemTile(
                  icon: Icons.workspace_premium_outlined,
                  title: 'Certificates',
                  onTap: () => context.push('/profile/certificates'),
                ),
                const Divider(
                    color: AppColors.border, height: 1, indent: 56),
                MenuItemTile(
                  icon: Icons.work_outline,
                  title: 'Jobs',
                  onTap: () => context.push('/profile/jobs'),
                ),
                const Divider(
                    color: AppColors.border, height: 1, indent: 56),
                MenuItemTile(
                  icon: Icons.campaign_outlined,
                  title: 'Announcements',
                  onTap: () => context.push('/profile/announcements'),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.space24),
          // Section 3: Sign Out.
          Container(
            decoration: BoxDecoration(
              color: AppColors.cardBg,
              borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
              boxShadow: AppShadows.sm,
            ),
            child: MenuItemTile(
              icon: Icons.logout,
              title: 'Sign Out',
              isDanger: true,
              showChevron: false,
              onTap: () => _confirmLogout(context, ref),
            ),
          ),
          const SizedBox(height: AppSpacing.space24),
          // App version.
          Center(
            child: Text(
              'v1.0.0',
              style: AppTextStyles.caption1,
            ),
          ),
          const SizedBox(height: AppSpacing.space16),
        ],
      ),
    );
  }

  void _confirmLogout(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.cardBg,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
        ),
        title: Text(
          'Sign Out',
          style: AppTextStyles.headline,
        ),
        content: Text(
          'Are you sure you want to sign out?',
          style: AppTextStyles.subheadline.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(
              'Cancel',
              style: AppTextStyles.body.copyWith(
                color: Theme.of(context).colorScheme.primary,
              ),
            ),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              ref.read(authProvider.notifier).logout();
            },
            child: Text(
              'Sign Out',
              style: AppTextStyles.body.copyWith(
                color: AppColors.error,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String title;

  const _SectionLabel({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 16),
      child: Text(
        title,
        style: AppTextStyles.overline.copyWith(
          color: AppColors.textTertiary,
        ),
      ),
    );
  }
}

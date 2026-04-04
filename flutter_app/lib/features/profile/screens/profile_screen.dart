import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_shadows.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/core/utils/responsive.dart';
import 'package:ict_lms_student/features/profile/widgets/menu_item_tile.dart';
import 'package:ict_lms_student/features/profile/widgets/profile_header.dart';
import 'package:ict_lms_student/providers/auth_provider.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

final _appVersionProvider = FutureProvider<String>((ref) async {
  final info = await PackageInfo.fromPlatform();
  return 'v${info.version} (${info.buildNumber})';
});

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
      body: Responsive.constrainWidth(
        context,
        child: ListView(
        padding: EdgeInsets.fromLTRB(
          Responsive.screenPadding(context),
          AppSpacing.space20,
          Responsive.screenPadding(context),
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
          Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
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
              ],
          ),
          const SizedBox(height: AppSpacing.space24),
          // Section 2: Explore.
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
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
                    Divider(
                        color: AppColors.border, height: 1, indent: 56),
                    MenuItemTile(
                      icon: Icons.settings_outlined,
                      title: 'Settings',
                      onTap: () => context.push('/profile/settings'),
                    ),
                  ],
                ),
              ),
            ],
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
              ref.watch(_appVersionProvider).valueOrNull ?? 'v1.0.0',
              style: AppTextStyles.caption1,
            ),
          ),
          const SizedBox(height: 8),
          Center(
            child: GestureDetector(
              onTap: () => launchUrl(Uri.parse('https://zensbot.com')),
              child: Text(
                'Powered by Zensbot.com',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12,
                  color: AppColors.textTertiary,
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.space16),
        ],
      ),
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
            onPressed: () async {
              Navigator.of(ctx).pop();
              await ref.read(authProvider.notifier).logout();
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Signed out successfully'),
                    duration: Duration(seconds: 2),
                  ),
                );
              }
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

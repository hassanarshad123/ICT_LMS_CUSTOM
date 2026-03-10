import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
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
      appBar: AppBar(
        title: const Text('Profile'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Profile header with avatar, name, email, role, batch badges.
          ProfileHeader(
            name: user?.name ?? '',
            email: user?.email ?? '',
            phone: user?.phone,
            avatarUrl: user?.avatarUrl,
            role: user?.role ?? 'student',
            batchNames: user?.batchNames ?? [],
            onEditTap: () => context.push('/profile/edit'),
          ),
          const SizedBox(height: 24),
          // Menu section: Account.
          _SectionLabel(title: 'Account'),
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
              color: AppColors.cardBg,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                MenuItemTile(
                  icon: Icons.lock_outline,
                  title: 'Change Password',
                  onTap: () => context.push('/profile/change-password'),
                ),
                const Divider(
                    color: AppColors.surfaceBg, height: 1, indent: 56),
                MenuItemTile(
                  icon: Icons.workspace_premium_outlined,
                  title: 'Certificates',
                  subtitle: 'View and request certificates',
                  onTap: () => context.push('/profile/certificates'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          // Menu section: Explore.
          _SectionLabel(title: 'Explore'),
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
              color: AppColors.cardBg,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                MenuItemTile(
                  icon: Icons.work_outline,
                  title: 'Jobs',
                  subtitle: 'Browse job openings',
                  onTap: () => context.push('/profile/jobs'),
                ),
                const Divider(
                    color: AppColors.surfaceBg, height: 1, indent: 56),
                MenuItemTile(
                  icon: Icons.campaign_outlined,
                  title: 'Announcements',
                  subtitle: 'Latest announcements',
                  onTap: () => context.push('/profile/announcements'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          // Menu section: Session.
          Container(
            decoration: BoxDecoration(
              color: AppColors.cardBg,
              borderRadius: BorderRadius.circular(16),
            ),
            child: MenuItemTile(
              icon: Icons.logout,
              title: 'Logout',
              isDanger: true,
              showChevron: false,
              onTap: () => _confirmLogout(context, ref),
            ),
          ),
          const SizedBox(height: 32),
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
          borderRadius: BorderRadius.circular(16),
        ),
        title: const Text(
          'Logout',
          style: TextStyle(color: AppColors.textPrimary),
        ),
        content: const Text(
          'Are you sure you want to logout?',
          style: TextStyle(color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              ref.read(authProvider.notifier).logout();
            },
            child: const Text(
              'Logout',
              style: TextStyle(color: AppColors.error),
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
    return Text(
      title,
      style: const TextStyle(
        color: AppColors.textTertiary,
        fontWeight: FontWeight.w600,
        fontSize: 13,
        letterSpacing: 0.5,
      ),
    );
  }
}

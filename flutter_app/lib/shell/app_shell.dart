import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/constants/app_colors.dart';
import '../core/constants/app_shadows.dart';
import '../providers/notification_count_provider.dart';

class AppShell extends ConsumerWidget {
  final Widget child;

  const AppShell({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationCount = ref.watch(notificationCountProvider);
    final location = GoRouterState.of(context).matchedLocation;
    final currentIndex = _calculateIndex(location);
    final accent = Theme.of(context).colorScheme.primary;
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      body: child,
      extendBody: true,
      bottomNavigationBar: Padding(
        padding: EdgeInsets.fromLTRB(16, 0, 16, bottomPadding + 8),
        child: Container(
          height: 64,
          decoration: BoxDecoration(
            color: AppColors.cardBg.withValues(alpha: 0.92),
            borderRadius: BorderRadius.circular(24),
            boxShadow: AppShadows.nav,
          ),
          clipBehavior: Clip.antiAlias,
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _NavItem(
                  icon: Icons.home_outlined,
                  activeIcon: Icons.home_rounded,
                  label: 'Home',
                  isActive: currentIndex == 0,
                  accentColor: accent,
                  onTap: () => _onTap(context, 0),
                ),
                _NavItem(
                  icon: Icons.book_outlined,
                  activeIcon: Icons.book_rounded,
                  label: 'Courses',
                  isActive: currentIndex == 1,
                  accentColor: accent,
                  onTap: () => _onTap(context, 1),
                ),
                _NavItem(
                  icon: Icons.videocam_outlined,
                  activeIcon: Icons.videocam_rounded,
                  label: 'Classes',
                  isActive: currentIndex == 2,
                  accentColor: accent,
                  onTap: () => _onTap(context, 2),
                ),
                _NavItem(
                  icon: Icons.notifications_outlined,
                  activeIcon: Icons.notifications_rounded,
                  label: 'Alerts',
                  isActive: currentIndex == 3,
                  accentColor: accent,
                  badgeCount: notificationCount,
                  onTap: () => _onTap(context, 3),
                ),
                _NavItem(
                  icon: Icons.person_outlined,
                  activeIcon: Icons.person_rounded,
                  label: 'Profile',
                  isActive: currentIndex == 4,
                  accentColor: accent,
                  onTap: () => _onTap(context, 4),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  int _calculateIndex(String location) {
    if (location.startsWith('/courses')) return 1;
    if (location.startsWith('/classes')) return 2;
    if (location.startsWith('/notifications')) return 3;
    if (location.startsWith('/profile')) return 4;
    return 0;
  }

  void _onTap(BuildContext context, int index) {
    switch (index) {
      case 0:
        context.go('/home');
      case 1:
        context.go('/courses');
      case 2:
        context.go('/classes');
      case 3:
        context.go('/notifications');
      case 4:
        context.go('/profile');
    }
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool isActive;
  final Color accentColor;
  final int badgeCount;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.isActive,
    required this.accentColor,
    this.badgeCount = 0,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 60,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Badge(
              label: Text(
                badgeCount > 99 ? '99+' : badgeCount.toString(),
                style: const TextStyle(fontSize: 10, color: Colors.white),
              ),
              isLabelVisible: badgeCount > 0,
              backgroundColor: AppColors.error,
              child: Icon(
                isActive ? activeIcon : icon,
                size: 24,
                color: isActive ? accentColor : AppColors.textTertiary,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                color: isActive ? accentColor : AppColors.textTertiary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

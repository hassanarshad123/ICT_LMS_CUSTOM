import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/constants/app_animations.dart';
import '../core/constants/app_colors.dart';
import '../core/constants/app_shadows.dart';
import '../core/utils/responsive.dart';
import '../providers/fullscreen_provider.dart';
import '../providers/notification_count_provider.dart';
import '../shared/widgets/offline_banner.dart';

class AppShell extends ConsumerWidget {
  final Widget child;

  const AppShell({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isFullscreen = ref.watch(fullscreenProvider);
    final notificationCount = ref.watch(notificationCountProvider);
    final location = GoRouterState.of(context).matchedLocation;
    final currentIndex = _calculateIndex(location);
    final accent = Theme.of(context).colorScheme.primary;
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    final hPad = Responsive.isCompact(context) ? 16.0 : 24.0;

    return Scaffold(
      body: OfflineBanner(child: child),
      extendBody: true,
      bottomNavigationBar: isFullscreen ? null : Padding(
        padding: EdgeInsets.fromLTRB(hPad, 0, hPad, bottomPadding + 8),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(28),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
            child: Container(
              height: 68,
              decoration: BoxDecoration(
                color: AppColors.cardBg.withValues(alpha: 0.78),
                borderRadius: BorderRadius.circular(28),
                border: Border.all(
                  color: AppColors.glassBorder,
                  width: 0.5,
                ),
                boxShadow: AppShadows.nav,
              ),
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
    AppAnimations.hapticSelection();
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
    final color = isActive ? accentColor : AppColors.textTertiary;

    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Animated icon swap with scale bounce
            AnimatedSwitcher(
              duration: AppAnimations.fast,
              switchInCurve: AppAnimations.curveAppleSpring,
              transitionBuilder: (child, animation) {
                return ScaleTransition(
                  scale: Tween<double>(begin: 0.8, end: 1.0).animate(animation),
                  child: FadeTransition(opacity: animation, child: child),
                );
              },
              child: Badge(
                key: ValueKey(isActive),
                label: Text(
                  badgeCount > 99 ? '99+' : badgeCount.toString(),
                  style: const TextStyle(fontSize: 10, color: Colors.white),
                ),
                isLabelVisible: badgeCount > 0,
                backgroundColor: AppColors.error,
                child: Icon(
                  isActive ? activeIcon : icon,
                  size: 24,
                  color: color,
                ),
              ),
            ),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 10,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                color: color,
              ),
            ),
            // Active indicator dot
            AnimatedContainer(
              duration: AppAnimations.fast,
              curve: AppAnimations.curveDefault,
              margin: const EdgeInsets.only(top: 2),
              width: isActive ? 4 : 0,
              height: isActive ? 4 : 0,
              decoration: BoxDecoration(
                color: accentColor,
                shape: BoxShape.circle,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

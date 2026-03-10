import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/notification_count_provider.dart';

class AppShell extends ConsumerWidget {
  final Widget child;

  const AppShell({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationCount = ref.watch(notificationCountProvider);
    final location = GoRouterState.of(context).matchedLocation;
    final currentIndex = _calculateIndex(location);

    return Scaffold(
      body: child,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: currentIndex,
        onTap: (index) => _onTap(context, index),
        items: [
          const BottomNavigationBarItem(
            icon: Icon(Icons.home_rounded),
            label: 'Home',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.book_rounded),
            label: 'Courses',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.videocam_rounded),
            label: 'Classes',
          ),
          BottomNavigationBarItem(
            icon: Badge(
              label: Text(
                notificationCount > 99 ? '99+' : notificationCount.toString(),
                style: const TextStyle(fontSize: 10),
              ),
              isLabelVisible: notificationCount > 0,
              child: const Icon(Icons.notifications_rounded),
            ),
            label: 'Alerts',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.person_rounded),
            label: 'Profile',
          ),
        ],
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

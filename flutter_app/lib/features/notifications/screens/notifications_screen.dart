import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/features/notifications/providers/notifications_provider.dart';
import 'package:ict_lms_student/features/notifications/widgets/notification_card.dart';
import 'package:ict_lms_student/providers/notification_count_provider.dart';

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref.read(notificationsProvider.notifier).loadMore();
    }
  }

  Future<void> _markAllRead() async {
    await ref.read(notificationsProvider.notifier).markAllRead();
    // Refresh the badge count.
    ref.read(notificationCountProvider.notifier).reset();
  }

  Future<void> _onNotificationTap(String notificationId) async {
    final notifier = ref.read(notificationsProvider.notifier);
    await notifier.markAsRead(notificationId);
    // Refresh the badge count.
    ref.read(notificationCountProvider.notifier).refresh();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(notificationsProvider);
    final hasUnread = state.items.any((n) => n.isUnread);

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        title: Text('Notifications', style: AppTextStyles.headline),
        backgroundColor: AppColors.cardBg,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        actions: [
          if (hasUnread)
            TextButton(
              onPressed: _markAllRead,
              child: Text(
                'Mark All Read',
                style: AppTextStyles.footnote.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
        ],
      ),
      body: _buildBody(state),
    );
  }

  Widget _buildBody(NotificationsState state) {
    if (state.isLoading && state.items.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (state.error != null && state.items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline,
                  color: AppColors.error, size: 48),
              const SizedBox(height: AppSpacing.space16),
              Text(
                state.error!,
                style: AppTextStyles.subheadline,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.space16),
              TextButton(
                onPressed: () =>
                    ref.read(notificationsProvider.notifier).refresh(),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (state.items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.notifications_none,
                color: AppColors.textTertiary, size: 64),
            const SizedBox(height: AppSpacing.space16),
            Text(
              'No notifications yet',
              style: AppTextStyles.callout,
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () async {
        await ref.read(notificationsProvider.notifier).refresh();
        ref.read(notificationCountProvider.notifier).refresh();
      },
      child: ListView.builder(
        controller: _scrollController,
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.screenH,
          AppSpacing.space16,
          AppSpacing.screenH,
          80,
        ),
        itemCount: state.items.length + (state.isLoadingMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index == state.items.length) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(AppSpacing.space16),
                child: CircularProgressIndicator(),
              ),
            );
          }

          final notification = state.items[index];
          return NotificationCard(
            notification: notification,
            onTap: notification.isUnread
                ? () => _onNotificationTap(notification.id)
                : null,
          );
        },
      ),
    );
  }
}

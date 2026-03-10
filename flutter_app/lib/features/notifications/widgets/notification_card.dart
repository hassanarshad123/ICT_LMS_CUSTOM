import 'package:flutter/material.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/models/notification_out.dart';
import 'package:intl/intl.dart';

class NotificationCard extends StatelessWidget {
  final NotificationOut notification;
  final VoidCallback? onTap;

  const NotificationCard({
    super.key,
    required this.notification,
    this.onTap,
  });

  IconData _typeIcon(String type) {
    return switch (type.toLowerCase()) {
      'announcement' => Icons.campaign_outlined,
      'class' || 'zoom' => Icons.videocam_outlined,
      'course' => Icons.school_outlined,
      'certificate' => Icons.workspace_premium_outlined,
      'job' => Icons.work_outline,
      'material' => Icons.folder_outlined,
      'recording' => Icons.video_library_outlined,
      'batch' => Icons.group_outlined,
      _ => Icons.notifications_outlined,
    };
  }

  Color _typeColor(String type) {
    return switch (type.toLowerCase()) {
      'announcement' => AppColors.warning,
      'class' || 'zoom' => AppColors.statusUpcoming,
      'course' => AppColors.success,
      'certificate' => const Color(0xFFF59E0B),
      'job' => const Color(0xFF8B5CF6),
      'material' => const Color(0xFF06B6D4),
      'recording' => AppColors.info,
      _ => AppColors.textTertiary,
    };
  }

  String _formatTime(DateTime? dateTime) {
    if (dateTime == null) return '';
    final now = DateTime.now();
    final diff = now.difference(dateTime);

    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return DateFormat('MMM d').format(dateTime);
  }

  @override
  Widget build(BuildContext context) {
    final accentColor = Theme.of(context).colorScheme.primary;
    final isUnread = notification.isUnread;
    final iconColor = _typeColor(notification.type);

    return Card(
      color: isUnread
          ? accentColor.withValues(alpha: 0.05)
          : AppColors.cardBg,
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: isUnread
            ? BorderSide(color: accentColor.withValues(alpha: 0.2), width: 1)
            : BorderSide.none,
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        splashColor: accentColor.withValues(alpha: 0.1),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Icon.
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  _typeIcon(notification.type),
                  color: iconColor,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              // Content.
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Title.
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            notification.title,
                            style: TextStyle(
                              color: AppColors.textPrimary,
                              fontWeight: isUnread
                                  ? FontWeight.w600
                                  : FontWeight.w500,
                              fontSize: 14,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          _formatTime(notification.createdAt),
                          style: const TextStyle(
                            color: AppColors.textTertiary,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    // Message.
                    Text(
                      notification.message,
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              // Unread indicator dot.
              if (isUnread)
                Padding(
                  padding: const EdgeInsets.only(left: 8, top: 4),
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: accentColor,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

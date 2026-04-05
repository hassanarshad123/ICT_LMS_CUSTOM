import 'package:flutter/material.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/shared/widgets/tap_scale.dart';
import 'package:ict_lms_student/core/constants/app_shadows.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
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

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.space8),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
        boxShadow: AppShadows.sm,
      ),
      child: TapScale(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.cardPadding),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Unread blue dot.
                if (isUnread)
                  Container(
                    width: 8,
                    height: 8,
                    margin: const EdgeInsets.only(top: 6, right: 8),
                    decoration: BoxDecoration(
                      color: accentColor,
                      shape: BoxShape.circle,
                    ),
                  ),
                // Type icon.
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: iconColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    _typeIcon(notification.type),
                    color: iconColor,
                    size: 20,
                  ),
                ),
                const SizedBox(width: AppSpacing.space12),
                // Content.
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Title + timestamp.
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              notification.title,
                              style: AppTextStyles.subheadline.copyWith(
                                color: AppColors.textPrimary,
                                fontWeight: isUnread
                                    ? FontWeight.w600
                                    : FontWeight.w500,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.space8),
                          Text(
                            _formatTime(notification.createdAt),
                            style: AppTextStyles.caption2,
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      // Message.
                      Text(
                        notification.message,
                        style: AppTextStyles.footnote.copyWith(
                          color: AppColors.textSecondary,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ),
    );
  }
}

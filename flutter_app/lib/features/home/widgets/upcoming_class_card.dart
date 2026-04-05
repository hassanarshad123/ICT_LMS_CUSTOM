import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/zoom_class_out.dart';
import '../../../shared/widgets/accent_card.dart';
import '../../../shared/widgets/status_badge.dart';

/// Card showing an upcoming Zoom class on the home dashboard.
///
/// Displays title, teacher name, scheduled date/time, status badge,
/// and a Join button that opens the Zoom meeting URL via url_launcher.
class UpcomingClassCard extends StatelessWidget {
  final ZoomClassOut zoomClass;

  const UpcomingClassCard({super.key, required this.zoomClass});

  @override
  Widget build(BuildContext context) {
    final accentColor = Theme.of(context).colorScheme.primary;

    return AccentCard(
      useGlass: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Title
          Text(
            zoomClass.title,
            style: AppTextStyles.headline,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: AppSpacing.space8),

          // Teacher name
          if (zoomClass.teacherName != null) ...[
            Row(
              children: [
                const Icon(
                  Icons.person_outline_rounded,
                  size: 16,
                  color: AppColors.textTertiary,
                ),
                const SizedBox(width: AppSpacing.space4),
                Text(
                  zoomClass.teacherName!,
                  style: AppTextStyles.footnote,
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.space4),
          ],

          // Date, time, and duration — time-prominent
          Row(
            children: [
              const Icon(
                Icons.calendar_today_rounded,
                size: 14,
                color: AppColors.textTertiary,
              ),
              const SizedBox(width: AppSpacing.space4),
              Text(
                _formatDateTime(),
                style: AppTextStyles.subheadline.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(width: AppSpacing.space12),
              const Icon(
                Icons.access_time_rounded,
                size: 14,
                color: AppColors.textTertiary,
              ),
              const SizedBox(width: AppSpacing.space4),
              Text(
                zoomClass.durationDisplay ?? '${zoomClass.duration} min',
                style: AppTextStyles.footnote,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.space12),

          // Status badge and Join button
          Row(
            children: [
              StatusBadge(status: zoomClass.status),
              const Spacer(),
              if (zoomClass.zoomMeetingUrl != null &&
                  zoomClass.zoomMeetingUrl!.isNotEmpty)
                SizedBox(
                  height: 36,
                  child: ElevatedButton.icon(
                    onPressed: () => _joinClass(context),
                    icon: const Icon(Icons.videocam_rounded, size: 18),
                    label: const Text(
                      'Join',
                      style: TextStyle(fontSize: 13),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: accentColor,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.space16,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(
                          AppSpacing.buttonRadius,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatDateTime() {
    // scheduledDate is a date string like "2026-03-15"
    // scheduledTime is a time string like "14:30"
    final dateParts = zoomClass.scheduledDate.split('-');
    if (dateParts.length == 3) {
      const months = [
        '',
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      final month = int.tryParse(dateParts[1]) ?? 1;
      final day = dateParts[2];
      return '${months[month]} $day, ${zoomClass.scheduledTime}';
    }
    return '${zoomClass.scheduledDate} ${zoomClass.scheduledTime}';
  }

  Future<void> _joinClass(BuildContext context) async {
    final url = zoomClass.zoomMeetingUrl;
    if (url == null || url.isEmpty) return;

    try {
      final uri = Uri.parse(url);
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not open Zoom meeting'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }
}

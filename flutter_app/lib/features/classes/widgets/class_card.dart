import 'package:flutter/material.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/models/zoom_class_out.dart';
import 'package:ict_lms_student/shared/widgets/status_badge.dart';

class ClassCard extends StatelessWidget {
  final ZoomClassOut zoomClass;
  final VoidCallback? onTap;

  const ClassCard({
    super.key,
    required this.zoomClass,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final accentColor = Theme.of(context).colorScheme.primary;

    return Card(
      color: AppColors.cardBg,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: zoomClass.isLive
            ? const BorderSide(color: AppColors.statusLive, width: 1.5)
            : BorderSide.none,
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        splashColor: accentColor.withValues(alpha: 0.1),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Title + status row.
              Row(
                children: [
                  Expanded(
                    child: Text(
                      zoomClass.title,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize: 16,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 12),
                  StatusBadge(status: zoomClass.status),
                ],
              ),
              const SizedBox(height: 12),
              // Date + time row.
              Row(
                children: [
                  const Icon(Icons.calendar_today,
                      size: 14, color: AppColors.textTertiary),
                  const SizedBox(width: 6),
                  Text(
                    zoomClass.scheduledDate,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(width: 16),
                  const Icon(Icons.access_time,
                      size: 14, color: AppColors.textTertiary),
                  const SizedBox(width: 6),
                  Text(
                    zoomClass.scheduledTime,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              // Teacher + batch + duration row.
              Row(
                children: [
                  if (zoomClass.teacherName != null) ...[
                    const Icon(Icons.person_outline,
                        size: 14, color: AppColors.textTertiary),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        zoomClass.teacherName!,
                        style: const TextStyle(
                          color: AppColors.textTertiary,
                          fontSize: 12,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                  if (zoomClass.batchName != null) ...[
                    const SizedBox(width: 12),
                    const Icon(Icons.group_outlined,
                        size: 14, color: AppColors.textTertiary),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        zoomClass.batchName!,
                        style: const TextStyle(
                          color: AppColors.textTertiary,
                          fontSize: 12,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                  if (zoomClass.durationDisplay != null) ...[
                    const SizedBox(width: 12),
                    const Icon(Icons.timer_outlined,
                        size: 14, color: AppColors.textTertiary),
                    const SizedBox(width: 6),
                    Text(
                      zoomClass.durationDisplay!,
                      style: const TextStyle(
                        color: AppColors.textTertiary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ],
              ),
              // Join button for live classes.
              if (zoomClass.isLive &&
                  zoomClass.zoomMeetingUrl != null &&
                  zoomClass.zoomMeetingUrl!.isNotEmpty) ...[
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: onTap,
                    icon: const Icon(Icons.videocam, size: 18),
                    label: const Text('Join Live Class'),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.statusLive,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

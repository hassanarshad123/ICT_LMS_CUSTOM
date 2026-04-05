import 'package:flutter/material.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/shared/widgets/tap_scale.dart';
import 'package:ict_lms_student/core/constants/app_shadows.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
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

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.space12),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
        boxShadow: AppShadows.sm,
        border: zoomClass.isLive
            ? Border.all(color: AppColors.statusLive, width: 1.5)
            : null,
      ),
      child: TapScale(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.cardPadding),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Date + time row (prominent, iOS title3 style).
                Row(
                  children: [
                    Icon(Icons.calendar_today,
                        size: 16, color: AppColors.textSecondary),
                    const SizedBox(width: 6),
                    Text(
                      zoomClass.scheduledDate,
                      style: AppTextStyles.headline,
                    ),
                    const SizedBox(width: AppSpacing.space16),
                    Icon(Icons.access_time,
                        size: 16, color: AppColors.textSecondary),
                    const SizedBox(width: 6),
                    Text(
                      zoomClass.scheduledTime,
                      style: AppTextStyles.headline,
                    ),
                    const Spacer(),
                    StatusBadge(status: zoomClass.status),
                  ],
                ),
                const SizedBox(height: AppSpacing.space12),
                // Title.
                Text(
                  zoomClass.title,
                  style: AppTextStyles.body.copyWith(
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: AppSpacing.space8),
                // Teacher + batch + duration row.
                Row(
                  children: [
                    if (zoomClass.teacherName != null) ...[
                      Icon(Icons.person_outline,
                          size: 14, color: AppColors.textTertiary),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          zoomClass.teacherName!,
                          style: AppTextStyles.caption1,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                    if (zoomClass.batchName != null) ...[
                      const SizedBox(width: AppSpacing.space12),
                      Icon(Icons.group_outlined,
                          size: 14, color: AppColors.textTertiary),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          zoomClass.batchName!,
                          style: AppTextStyles.caption1,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                    if (zoomClass.durationDisplay != null) ...[
                      const SizedBox(width: AppSpacing.space12),
                      Icon(Icons.timer_outlined,
                          size: 14, color: AppColors.textTertiary),
                      const SizedBox(width: 4),
                      Text(
                        zoomClass.durationDisplay!,
                        style: AppTextStyles.caption1,
                      ),
                    ],
                  ],
                ),
                // Join button for live classes.
                if (zoomClass.isLive &&
                    zoomClass.zoomMeetingUrl != null &&
                    zoomClass.zoomMeetingUrl!.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.space12),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: onTap,
                      icon: const Icon(Icons.videocam, size: 18),
                      label: const Text('Join Live Class'),
                      style: FilledButton.styleFrom(
                        backgroundColor: accentColor,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius:
                              BorderRadius.circular(AppSpacing.buttonRadius),
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

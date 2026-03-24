import 'package:flutter/material.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/models/lecture_out.dart';

class LectureItem extends StatelessWidget {
  final LectureOut lecture;
  final VoidCallback? onTap;

  const LectureItem({
    super.key,
    required this.lecture,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final accentColor = Theme.of(context).colorScheme.primary;
    final isPlayable = lecture.videoStatus == 'ready' ||
        (lecture.videoType == 'external' &&
            lecture.videoUrl != null &&
            lecture.videoUrl!.isNotEmpty);

    return ListTile(
      onTap: isPlayable ? onTap : null,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.space4,
        vertical: AppSpacing.space4,
      ),
      leading: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: isPlayable
              ? accentColor.withValues(alpha: 0.1)
              : AppColors.inputBg,
          borderRadius: BorderRadius.circular(AppSpacing.inputRadius),
        ),
        child: Icon(
          isPlayable ? Icons.play_circle_fill : Icons.hourglass_empty,
          color: isPlayable ? accentColor : AppColors.textTertiary,
          size: 24,
        ),
      ),
      title: Text(
        lecture.title,
        style: AppTextStyles.subheadline.copyWith(
          color: isPlayable ? AppColors.textPrimary : AppColors.textTertiary,
          fontWeight: FontWeight.w500,
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Row(
        children: [
          if (lecture.durationDisplay != null) ...[
            const Icon(Icons.access_time,
                size: 14, color: AppColors.textTertiary),
            const SizedBox(width: AppSpacing.space4),
            Text(
              lecture.durationDisplay!,
              style: AppTextStyles.caption1,
            ),
          ],
          if (lecture.videoStatus != null &&
              lecture.videoStatus != 'ready') ...[
            if (lecture.durationDisplay != null)
              const SizedBox(width: AppSpacing.space12),
            _VideoStatusIndicator(status: lecture.videoStatus!),
          ],
        ],
      ),
      trailing: Icon(
        Icons.chevron_right,
        color: isPlayable ? AppColors.textTertiary : Colors.transparent,
        size: 20,
      ),
    );
  }
}

class _VideoStatusIndicator extends StatelessWidget {
  final String status;

  const _VideoStatusIndicator({required this.status});

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      'processing' || 'pending' => AppColors.warning,
      'failed' => AppColors.error,
      'ready' => AppColors.success,
      _ => AppColors.textTertiary,
    };

    final label = switch (status) {
      'processing' => 'Processing',
      'pending' => 'Pending',
      'failed' => 'Failed',
      'ready' => 'Ready',
      _ => status,
    };

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: AppSpacing.space4),
        Text(
          label,
          style: TextStyle(color: color, fontSize: 12),
        ),
      ],
    );
  }
}

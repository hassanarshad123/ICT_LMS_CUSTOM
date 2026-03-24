import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/announcement_out.dart';
import '../../../shared/widgets/accent_card.dart';
import '../../../shared/widgets/status_badge.dart';
import '../../../shared/extensions/date_extensions.dart';

/// Card showing a preview of an announcement on the home dashboard.
///
/// Displays scope badge, relative time, title, content preview (2 lines),
/// and the poster's name.
class AnnouncementPreview extends StatelessWidget {
  final AnnouncementOut announcement;

  const AnnouncementPreview({super.key, required this.announcement});

  @override
  Widget build(BuildContext context) {
    return AccentCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Scope badge and time
          Row(
            children: [
              StatusBadge(status: announcement.scope),
              const Spacer(),
              if (announcement.createdAt != null)
                Text(
                  announcement.createdAt!.toRelative,
                  style: AppTextStyles.caption1,
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.space8),

          // Title
          Text(
            announcement.title,
            style: AppTextStyles.headline,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: AppSpacing.space4),

          // Content preview (2-line clamp)
          Text(
            announcement.content,
            style: AppTextStyles.footnote.copyWith(
              color: AppColors.textSecondary,
              height: 1.4,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),

          // Posted by
          if (announcement.postedByName != null &&
              announcement.postedByName!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.space8),
            Text(
              'by ${announcement.postedByName}',
              style: AppTextStyles.caption1.copyWith(
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_shadows.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/models/curriculum_module_out.dart';

class CurriculumModuleItem extends StatelessWidget {
  final CurriculumModuleOut module;

  const CurriculumModuleItem({
    super.key,
    required this.module,
  });

  @override
  Widget build(BuildContext context) {
    final accentColor = Theme.of(context).colorScheme.primary;

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.space8),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
        boxShadow: AppShadows.sm,
      ),
      clipBehavior: Clip.antiAlias,
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.space16,
          vertical: AppSpacing.space4,
        ),
        childrenPadding: const EdgeInsets.only(
          left: AppSpacing.space16,
          right: AppSpacing.space16,
          bottom: AppSpacing.space12,
        ),
        iconColor: AppColors.textSecondary,
        collapsedIconColor: AppColors.textTertiary,
        leading: Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: accentColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Center(
            child: Text(
              '${module.sequenceOrder}',
              style: AppTextStyles.subheadline.copyWith(
                color: accentColor,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
        title: Text(
          module.title,
          style: AppTextStyles.headline.copyWith(fontSize: 15),
        ),
        subtitle: module.description != null && module.description!.isNotEmpty
            ? Padding(
                padding: const EdgeInsets.only(top: AppSpacing.space4),
                child: Text(
                  module.description!,
                  style: AppTextStyles.footnote,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              )
            : null,
        children: [
          if (module.topics != null && module.topics!.isNotEmpty)
            ...module.topics!.map(
              (topic) => Padding(
                padding: const EdgeInsets.symmetric(
                  vertical: AppSpacing.space4,
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: accentColor,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.space12),
                    Expanded(
                      child: Text(
                        topic,
                        style: AppTextStyles.subheadline.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          if (module.topics == null || module.topics!.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(
                vertical: AppSpacing.space4,
              ),
              child: Text(
                'No topics listed',
                style: AppTextStyles.footnote.copyWith(
                  fontStyle: FontStyle.italic,
                  color: AppColors.textTertiary,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

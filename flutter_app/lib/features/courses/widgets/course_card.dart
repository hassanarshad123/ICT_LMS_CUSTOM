import 'package:flutter/material.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/models/course_out.dart';
import 'package:ict_lms_student/shared/widgets/accent_card.dart';
import 'package:ict_lms_student/shared/widgets/status_badge.dart';

class CourseCard extends StatelessWidget {
  final CourseOut course;
  final VoidCallback? onTap;

  const CourseCard({
    super.key,
    required this.course,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return AccentCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Title.
          Text(
            course.title,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          // Description.
          if (course.description != null &&
              course.description!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              course.description!,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 13,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          const SizedBox(height: 12),
          // Status badge + batch count.
          Row(
            children: [
              StatusBadge(status: course.status),
              const Spacer(),
              if (course.batchIds.isNotEmpty)
                Text(
                  '${course.batchIds.length} batch${course.batchIds.length != 1 ? 'es' : ''}',
                  style: const TextStyle(
                    color: AppColors.textTertiary,
                    fontSize: 12,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

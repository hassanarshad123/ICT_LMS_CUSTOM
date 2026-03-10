import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';

class StatusBadge extends StatelessWidget {
  final String status;
  final double fontSize;

  const StatusBadge({
    super.key,
    required this.status,
    this.fontSize = 11,
  });

  @override
  Widget build(BuildContext context) {
    final color = _getStatusColor(status);
    final label = _formatLabel(status);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: fontSize,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.3,
        ),
      ),
    );
  }

  Color _getStatusColor(String status) {
    final normalized = status.toLowerCase().replaceAll('-', '_');
    return switch (normalized) {
      'upcoming' => AppColors.statusUpcoming,
      'active' => AppColors.statusActive,
      'completed' => AppColors.statusCompleted,
      'live' => AppColors.statusLive,
      'eligible' => AppColors.success,
      'approved' => AppColors.success,
      'revoked' => AppColors.error,
      'applied' => AppColors.statusUpcoming,
      'shortlisted' => AppColors.success,
      'rejected' => AppColors.error,
      'processing' => AppColors.warning,
      'ready' => AppColors.success,
      'failed' => AppColors.error,
      'pending' => AppColors.warning,
      'institute' => AppColors.info,
      'batch' => AppColors.statusActive,
      'course' => AppColors.warning,
      'student' => AppColors.statusUpcoming,
      'teacher' => AppColors.statusActive,
      'admin' => AppColors.warning,
      _ => AppColors.textTertiary,
    };
  }

  String _formatLabel(String status) {
    // Convert snake_case or kebab-case to Title Case
    return status
        .replaceAll('_', ' ')
        .replaceAll('-', ' ')
        .split(' ')
        .map((word) =>
            word.isEmpty ? '' : '${word[0].toUpperCase()}${word.substring(1)}')
        .join(' ');
  }
}

import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';

/// Flat colored pill badge — no glass morphism blur.
class StatusBadge extends StatelessWidget {
  final String status;
  final double fontSize;

  const StatusBadge({
    super.key,
    required this.status,
    this.fontSize = 12,
  });

  @override
  Widget build(BuildContext context) {
    final config = _statusConfig(status);
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: fontSize < 12 ? 8 : 10,
        vertical: fontSize < 12 ? 3 : 4,
      ),
      decoration: BoxDecoration(
        color: config.color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(100),
      ),
      child: Text(
        config.label,
        style: TextStyle(
          color: config.color,
          fontSize: fontSize,
          fontWeight: FontWeight.w600,
          height: 1.2,
        ),
      ),
    );
  }

  static _StatusConfig _statusConfig(String status) {
    final normalized = status.toLowerCase().replaceAll('-', '_');
    return switch (normalized) {
      'active' || 'live' || 'ready' => _StatusConfig('Active', AppColors.success),
      'upcoming' || 'pending' || 'processing' => _StatusConfig('Upcoming', AppColors.info),
      'completed' || 'approved' || 'graded' => _StatusConfig('Completed', AppColors.textTertiary),
      'eligible' => _StatusConfig('Eligible', AppColors.success),
      'revoked' || 'failed' || 'rejected' => _StatusConfig('Revoked', AppColors.error),
      'expired' => _StatusConfig('Expired', AppColors.warning),
      'institute' => _StatusConfig('Institute', AppColors.info),
      'batch' => _StatusConfig('Batch', AppColors.success),
      'course' => _StatusConfig('Course', AppColors.warning),
      'in_progress' => _StatusConfig('In Progress', AppColors.info),
      'applied' || 'shortlisted' => _StatusConfig(
          _titleCase(status),
          AppColors.info,
        ),
      _ => _StatusConfig(_titleCase(status), AppColors.textSecondary),
    };
  }

  static String _titleCase(String text) {
    return text
        .replaceAll('_', ' ')
        .replaceAll('-', ' ')
        .split(' ')
        .map((w) => w.isEmpty ? '' : '${w[0].toUpperCase()}${w.substring(1)}')
        .join(' ');
  }
}

class _StatusConfig {
  final String label;
  final Color color;
  const _StatusConfig(this.label, this.color);
}

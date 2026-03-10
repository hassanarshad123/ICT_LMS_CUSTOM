import 'package:flutter/material.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/models/recording_list_out.dart';
import 'package:ict_lms_student/shared/widgets/status_badge.dart';
import 'package:intl/intl.dart';

class RecordingCard extends StatelessWidget {
  final RecordingListOut recording;
  final VoidCallback? onTap;

  const RecordingCard({
    super.key,
    required this.recording,
    this.onTap,
  });

  String _formatDuration(int? seconds) {
    if (seconds == null || seconds <= 0) return '';
    final minutes = seconds ~/ 60;
    final hours = minutes ~/ 60;
    final remainingMinutes = minutes % 60;
    if (hours > 0) {
      return '${hours}h ${remainingMinutes}m';
    }
    return '${minutes}m';
  }

  String _formatDate(DateTime? date) {
    if (date == null) return '';
    return DateFormat('MMM d, yyyy').format(date);
  }

  String _formatFileSize(int? bytes) {
    if (bytes == null || bytes <= 0) return '';
    if (bytes < 1024 * 1024) {
      return '${(bytes / 1024).toStringAsFixed(0)} KB';
    }
    if (bytes < 1024 * 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }

  @override
  Widget build(BuildContext context) {
    final accentColor = Theme.of(context).colorScheme.primary;

    return Card(
      color: AppColors.cardBg,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      child: InkWell(
        onTap: recording.isReady ? onTap : null,
        borderRadius: BorderRadius.circular(16),
        splashColor: accentColor.withValues(alpha: 0.1),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Play icon / processing indicator.
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: recording.isReady
                      ? accentColor.withValues(alpha: 0.15)
                      : AppColors.surfaceBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  recording.isReady
                      ? Icons.play_circle_fill
                      : recording.isProcessing
                          ? Icons.hourglass_empty
                          : Icons.error_outline,
                  color: recording.isReady
                      ? accentColor
                      : recording.isProcessing
                          ? AppColors.warning
                          : AppColors.error,
                  size: 28,
                ),
              ),
              const SizedBox(width: 12),
              // Content.
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Title.
                    Text(
                      recording.classTitle,
                      style: TextStyle(
                        color: recording.isReady
                            ? AppColors.textPrimary
                            : AppColors.textTertiary,
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    // Metadata row.
                    Wrap(
                      spacing: 12,
                      runSpacing: 4,
                      children: [
                        if (recording.scheduledDate != null)
                          _MetaChip(
                            icon: Icons.calendar_today,
                            label: _formatDate(recording.scheduledDate),
                          ),
                        if (recording.scheduledTime != null)
                          _MetaChip(
                            icon: Icons.access_time,
                            label: recording.scheduledTime!,
                          ),
                        if (recording.duration != null &&
                            recording.duration! > 0)
                          _MetaChip(
                            icon: Icons.timer_outlined,
                            label: _formatDuration(recording.duration),
                          ),
                        if (recording.fileSize != null &&
                            recording.fileSize! > 0)
                          _MetaChip(
                            icon: Icons.storage,
                            label: _formatFileSize(recording.fileSize),
                          ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    // Teacher + batch + status.
                    Row(
                      children: [
                        if (recording.teacherName != null) ...[
                          Flexible(
                            child: Text(
                              recording.teacherName!,
                              style: const TextStyle(
                                color: AppColors.textTertiary,
                                fontSize: 12,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (recording.batchName != null)
                            const SizedBox(width: 8),
                        ],
                        if (recording.batchName != null)
                          Flexible(
                            child: Text(
                              recording.batchName!,
                              style: const TextStyle(
                                color: AppColors.textTertiary,
                                fontSize: 12,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        const Spacer(),
                        if (!recording.isReady)
                          StatusBadge(status: recording.status, fontSize: 10),
                      ],
                    ),
                  ],
                ),
              ),
              // Chevron for ready recordings.
              if (recording.isReady)
                Padding(
                  padding: const EdgeInsets.only(left: 4, top: 12),
                  child: Icon(
                    Icons.chevron_right,
                    color: AppColors.textTertiary,
                    size: 20,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _MetaChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: AppColors.textTertiary),
        const SizedBox(width: 4),
        Text(
          label,
          style: const TextStyle(
            color: AppColors.textTertiary,
            fontSize: 12,
          ),
        ),
      ],
    );
  }
}

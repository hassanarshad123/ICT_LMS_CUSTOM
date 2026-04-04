import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';

/// Banner displayed when a student's batch access has expired or is expiring soon.
///
/// Shows red for expired, amber for expiring within 7 days.
class AccessExpiredBanner extends StatelessWidget {
  final bool isExpired;
  final DateTime? effectiveEndDate;

  const AccessExpiredBanner({
    super.key,
    required this.isExpired,
    this.effectiveEndDate,
  });

  @override
  Widget build(BuildContext context) {
    if (!isExpired && !_isExpiringSoon) return const SizedBox.shrink();

    final bgColor = isExpired ? AppColors.error.withValues(alpha: 0.1) : Colors.amber.withValues(alpha: 0.1);
    final borderColor = isExpired ? AppColors.error.withValues(alpha: 0.3) : Colors.amber.withValues(alpha: 0.3);
    final iconColor = isExpired ? AppColors.error : Colors.amber.shade700;
    final textColor = isExpired ? AppColors.error : Colors.amber.shade800;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderColor),
      ),
      child: Row(
        children: [
          Icon(
            isExpired ? Icons.lock_outline : Icons.schedule,
            size: 20,
            color: iconColor,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isExpired
                      ? 'Your access to this batch has expired'
                      : 'Your access expires in ${_daysLeft} day${_daysLeft == 1 ? '' : 's'}',
                  style: TextStyle(
                    color: textColor,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (effectiveEndDate != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      isExpired
                          ? 'Expired on ${_formatDate(effectiveEndDate!)}'
                          : 'Access until ${_formatDate(effectiveEndDate!)}',
                      style: TextStyle(
                        color: textColor.withValues(alpha: 0.7),
                        fontSize: 11,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  bool get _isExpiringSoon {
    if (effectiveEndDate == null) return false;
    final daysLeft = effectiveEndDate!.difference(DateTime.now()).inDays;
    return daysLeft >= 0 && daysLeft <= 7;
  }

  int get _daysLeft {
    if (effectiveEndDate == null) return 0;
    return effectiveEndDate!.difference(DateTime.now()).inDays;
  }

  String _formatDate(DateTime date) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${months[date.month - 1]} ${date.day}, ${date.year}';
  }
}

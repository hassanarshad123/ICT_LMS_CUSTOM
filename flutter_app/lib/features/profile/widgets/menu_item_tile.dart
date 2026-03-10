import 'package:flutter/material.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';

class MenuItemTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final Color? iconColor;
  final Widget? trailing;
  final bool showChevron;
  final bool isDanger;

  const MenuItemTile({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.onTap,
    this.iconColor,
    this.trailing,
    this.showChevron = true,
    this.isDanger = false,
  });

  @override
  Widget build(BuildContext context) {
    final accentColor = Theme.of(context).colorScheme.primary;
    final effectiveIconColor =
        isDanger ? AppColors.error : (iconColor ?? accentColor);

    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: effectiveIconColor.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(
          icon,
          color: effectiveIconColor,
          size: 20,
        ),
      ),
      title: Text(
        title,
        style: TextStyle(
          color: isDanger ? AppColors.error : AppColors.textPrimary,
          fontWeight: FontWeight.w500,
          fontSize: 15,
        ),
      ),
      subtitle: subtitle != null
          ? Text(
              subtitle!,
              style: const TextStyle(
                color: AppColors.textTertiary,
                fontSize: 12,
              ),
            )
          : null,
      trailing: trailing ??
          (showChevron
              ? Icon(
                  Icons.chevron_right,
                  color: AppColors.textTertiary,
                  size: 20,
                )
              : null),
    );
  }
}

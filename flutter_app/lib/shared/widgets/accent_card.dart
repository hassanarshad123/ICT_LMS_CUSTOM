import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';

class AccentCard extends StatelessWidget {
  final Widget child;
  final bool hasAccentBorder;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry? padding;
  final double borderRadius;

  const AccentCard({
    super.key,
    required this.child,
    this.hasAccentBorder = false,
    this.onTap,
    this.padding,
    this.borderRadius = 16,
  });

  @override
  Widget build(BuildContext context) {
    final accentColor = Theme.of(context).colorScheme.primary;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(borderRadius),
          border: hasAccentBorder
              ? Border(
                  left: BorderSide(
                    color: accentColor,
                    width: 4,
                  ),
                )
              : null,
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(borderRadius),
            splashColor: accentColor.withValues(alpha: 0.1),
            highlightColor: accentColor.withValues(alpha: 0.05),
            child: Padding(
              padding: padding ?? const EdgeInsets.all(16),
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}

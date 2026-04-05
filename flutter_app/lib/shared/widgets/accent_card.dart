import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_shadows.dart';
import '../../core/constants/app_spacing.dart';
import 'tap_scale.dart';

class AccentCard extends StatelessWidget {
  final Widget child;
  final bool hasAccentBorder;
  final bool useGlass; // kept for API compat but ignored — glass removed
  final VoidCallback? onTap;
  final EdgeInsetsGeometry? padding;
  final double borderRadius;
  final Color? accentColor; // optional left accent strip

  const AccentCard({
    super.key,
    required this.child,
    this.hasAccentBorder = false,
    this.useGlass = false,
    this.onTap,
    this.padding,
    this.borderRadius = AppSpacing.cardRadius,
    this.accentColor,
  });

  @override
  Widget build(BuildContext context) {
    final cardPadding = padding ?? const EdgeInsets.all(AppSpacing.cardPadding);

    return TapScale(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(borderRadius),
          border: Border.all(color: AppColors.border, width: 1),
          boxShadow: AppShadows.sm,
        ),
        clipBehavior: Clip.antiAlias,
        child: Row(
          children: [
            // Optional left accent strip
            if (accentColor != null)
              Container(
                width: 4,
                color: accentColor,
              ),
            Expanded(
              child: Padding(padding: cardPadding, child: child),
            ),
          ],
        ),
      ),
    );
  }
}

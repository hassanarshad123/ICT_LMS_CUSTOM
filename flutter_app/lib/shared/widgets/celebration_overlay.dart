import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../core/constants/app_animations.dart';
import '../../core/constants/app_colors.dart';

/// Subtle Apple-style celebration: a checkmark that scales in with a spring
/// curve, plus a brief ring burst.
///
/// Use after a milestone event (quiz pass, certificate earn):
/// ```dart
/// CelebrationOverlay(
///   show: attempt.passed,
///   delay: Duration(milliseconds: 1200),
///   child: existingContent,
/// )
/// ```
class CelebrationOverlay extends StatelessWidget {
  final bool show;
  final Duration delay;
  final Widget child;
  final double iconSize;

  const CelebrationOverlay({
    super.key,
    required this.show,
    this.delay = Duration.zero,
    required this.child,
    this.iconSize = 48,
  });

  @override
  Widget build(BuildContext context) {
    if (!show) return child;

    return Stack(
      alignment: Alignment.center,
      children: [
        child,
        // Ring burst
        Container(
          width: iconSize * 2,
          height: iconSize * 2,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.success.withAlpha(80), width: 2),
          ),
        )
            .animate(delay: delay)
            .scale(
              begin: const Offset(0.5, 0.5),
              end: const Offset(1.5, 1.5),
              duration: AppAnimations.celebration,
              curve: AppAnimations.curveEnter,
            )
            .fadeOut(
              delay: AppAnimations.normal,
              duration: AppAnimations.slow,
            ),
        // Checkmark
        Icon(
          Icons.check_circle_rounded,
          color: AppColors.success,
          size: iconSize,
        )
            .animate(delay: delay)
            .scale(
              begin: const Offset(0, 0),
              end: const Offset(1, 1),
              duration: AppAnimations.slow,
              curve: AppAnimations.curveSpring,
            )
            .then(delay: AppAnimations.slow)
            .fadeOut(duration: AppAnimations.normal),
      ],
    );
  }
}

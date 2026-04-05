import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../core/constants/app_animations.dart';

/// Wraps a child with staggered fade + slide-up entrance animation.
///
/// Use in `ListView.builder` / `GridView.builder` itemBuilder:
/// ```dart
/// AnimatedListItem(index: index, child: MyCard(...))
/// ```
class AnimatedListItem extends StatelessWidget {
  final Widget child;
  final int index;
  final Duration? delay;
  final Duration? duration;
  final bool horizontal;

  const AnimatedListItem({
    super.key,
    required this.child,
    required this.index,
    this.delay,
    this.duration,
    this.horizontal = false,
  });

  @override
  Widget build(BuildContext context) {
    final itemDelay = delay ?? (AppAnimations.listItemDelay * index);
    final itemDuration = duration ?? AppAnimations.normal;

    if (horizontal) {
      return child
          .animate()
          .fadeIn(
            duration: itemDuration,
            curve: AppAnimations.curveEnter,
            delay: itemDelay,
          )
          .slideX(
            begin: 0.08,
            end: 0,
            duration: itemDuration,
            curve: AppAnimations.curveEnter,
            delay: itemDelay,
          );
    }

    return child
        .animate()
        .fadeIn(
          duration: itemDuration,
          curve: AppAnimations.curveEnter,
          delay: itemDelay,
        )
        .slideY(
          begin: 0.04,
          end: 0,
          duration: itemDuration,
          curve: AppAnimations.curveEnter,
          delay: itemDelay,
        );
  }
}

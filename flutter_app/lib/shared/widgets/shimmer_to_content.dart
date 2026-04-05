import 'package:flutter/material.dart';
import '../../core/constants/app_animations.dart';

/// Crossfades from a shimmer skeleton to real content.
///
/// Replaces the instant snap that happens with conditional rendering.
/// ```dart
/// ShimmerToContent(
///   isLoading: state.isLoading,
///   shimmer: ShimmerList(itemCount: 5),
///   content: MyRealContent(),
/// )
/// ```
class ShimmerToContent extends StatelessWidget {
  final bool isLoading;
  final Widget shimmer;
  final Widget content;

  const ShimmerToContent({
    super.key,
    required this.isLoading,
    required this.shimmer,
    required this.content,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: AppAnimations.normal,
      switchInCurve: AppAnimations.curveEnter,
      switchOutCurve: AppAnimations.curveExit,
      child: isLoading
          ? KeyedSubtree(key: const ValueKey('shimmer'), child: shimmer)
          : KeyedSubtree(key: const ValueKey('content'), child: content),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../../core/constants/app_colors.dart';

/// A single shimmer placeholder card.
class ShimmerCard extends StatelessWidget {
  final double height;
  final double? width;
  final double borderRadius;

  const ShimmerCard({
    super.key,
    this.height = 100,
    this.width,
    this.borderRadius = 16,
  });

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: AppColors.cardBg,
      highlightColor: AppColors.surfaceBg,
      child: Container(
        height: height,
        width: width,
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(borderRadius),
        ),
      ),
    );
  }
}

/// A column of shimmer placeholder cards for list loading states.
class ShimmerList extends StatelessWidget {
  final int itemCount;
  final double itemHeight;
  final double spacing;
  final EdgeInsetsGeometry padding;

  const ShimmerList({
    super.key,
    this.itemCount = 5,
    this.itemHeight = 100,
    this.spacing = 12,
    this.padding = const EdgeInsets.all(16),
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Column(
        children: List.generate(
          itemCount,
          (index) => Padding(
            padding: EdgeInsets.only(bottom: index < itemCount - 1 ? spacing : 0),
            child: ShimmerCard(height: itemHeight),
          ),
        ),
      ),
    );
  }
}

/// Shimmer placeholder for a horizontal scrolling list.
class ShimmerHorizontalList extends StatelessWidget {
  final int itemCount;
  final double itemHeight;
  final double itemWidth;
  final double spacing;
  final EdgeInsetsGeometry padding;

  const ShimmerHorizontalList({
    super.key,
    this.itemCount = 3,
    this.itemHeight = 140,
    this.itemWidth = 240,
    this.spacing = 12,
    this.padding = const EdgeInsets.symmetric(horizontal: 16),
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: itemHeight,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: padding,
        itemCount: itemCount,
        separatorBuilder: (_, __) => SizedBox(width: spacing),
        itemBuilder: (_, __) => ShimmerCard(
          height: itemHeight,
          width: itemWidth,
        ),
      ),
    );
  }
}

/// A shimmer placeholder for a greeting/banner section.
class ShimmerBanner extends StatelessWidget {
  const ShimmerBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Shimmer.fromColors(
        baseColor: AppColors.cardBg,
        highlightColor: AppColors.surfaceBg,
        child: Container(
          height: 120,
          decoration: BoxDecoration(
            color: AppColors.cardBg,
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
    );
  }
}

/// A row of shimmer stat cards.
class ShimmerStatRow extends StatelessWidget {
  final int count;

  const ShimmerStatRow({super.key, this.count = 3});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Shimmer.fromColors(
        baseColor: AppColors.cardBg,
        highlightColor: AppColors.surfaceBg,
        child: Row(
          children: List.generate(
            count,
            (index) => Expanded(
              child: Container(
                margin: EdgeInsets.only(
                  right: index < count - 1 ? 12 : 0,
                ),
                height: 80,
                decoration: BoxDecoration(
                  color: AppColors.cardBg,
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

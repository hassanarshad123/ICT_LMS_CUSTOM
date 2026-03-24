import 'dart:math';
import 'package:flutter/material.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';

class ScoreGauge extends StatelessWidget {
  final int? percentage;
  final bool? passed;
  final double size;

  const ScoreGauge({
    super.key,
    this.percentage,
    this.passed,
    this.size = 160,
  });

  @override
  Widget build(BuildContext context) {
    if (percentage == null) {
      return SizedBox(
        width: size,
        height: size,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.hourglass_empty,
                size: 40, color: AppColors.textTertiary),
            const SizedBox(height: 8),
            Text(
              'Pending',
              style: AppTextStyles.callout.copyWith(
                color: AppColors.textTertiary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      );
    }

    final gaugeColor = (passed == true) ? AppColors.success : AppColors.error;
    final label = (passed == true) ? 'Passed' : 'Failed';

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: percentage! / 100),
      duration: const Duration(milliseconds: 1200),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return SizedBox(
          width: size,
          height: size,
          child: CustomPaint(
            painter: _GaugePainter(
              progress: value,
              color: gaugeColor,
              trackColor: AppColors.border,
            ),
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    '${(value * 100).round()}%',
                    style: AppTextStyles.largeTitle.copyWith(
                      color: gaugeColor,
                      fontSize: 32,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    label,
                    style: AppTextStyles.subheadline.copyWith(
                      color: gaugeColor,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _GaugePainter extends CustomPainter {
  final double progress;
  final Color color;
  final Color trackColor;

  _GaugePainter({
    required this.progress,
    required this.color,
    required this.trackColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = min(size.width, size.height) / 2 - 8;
    const strokeWidth = 10.0;
    const startAngle = -pi / 2;
    const sweepAngle = 2 * pi;

    // Track
    final trackPaint = Paint()
      ..color = trackColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(center, radius, trackPaint);

    // Progress arc
    final progressPaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      startAngle,
      sweepAngle * progress,
      false,
      progressPaint,
    );
  }

  @override
  bool shouldRepaint(_GaugePainter oldDelegate) =>
      oldDelegate.progress != progress || oldDelegate.color != color;
}

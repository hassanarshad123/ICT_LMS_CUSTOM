import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

class LoadingIndicator extends StatelessWidget {
  final double size;
  final double strokeWidth;

  const LoadingIndicator({
    super.key,
    this.size = 40.0,
    this.strokeWidth = 3.0,
  });

  @override
  Widget build(BuildContext context) {
    final accentColor = Theme.of(context).colorScheme.primary;
    return Center(
      child: SizedBox(
        width: size,
        height: size,
        child: CupertinoActivityIndicator(
          radius: size / 2.5,
          color: accentColor,
        ),
      ),
    );
  }
}

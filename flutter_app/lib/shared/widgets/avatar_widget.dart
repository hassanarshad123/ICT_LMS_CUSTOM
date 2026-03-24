import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/constants/app_colors.dart';

class AvatarWidget extends StatelessWidget {
  final String? imageUrl;
  final String? name;
  final double radius;
  final Color? backgroundColor;

  const AvatarWidget({
    super.key,
    this.imageUrl,
    this.name,
    this.radius = 20,
    this.backgroundColor,
  });

  @override
  Widget build(BuildContext context) {
    final accentColor = Theme.of(context).colorScheme.primary;
    final bgColor = backgroundColor ?? AppColors.scaffoldBg;
    final initials = _getInitials(name);

    if (imageUrl != null && imageUrl!.isNotEmpty) {
      return CircleAvatar(
        radius: radius,
        backgroundColor: bgColor,
        child: ClipOval(
          child: CachedNetworkImage(
            imageUrl: imageUrl!,
            width: radius * 2,
            height: radius * 2,
            fit: BoxFit.cover,
            placeholder: (context, url) => _InitialsAvatar(
              initials: initials,
              radius: radius,
              backgroundColor: bgColor,
              textColor: accentColor,
            ),
            errorWidget: (context, url, error) => _InitialsAvatar(
              initials: initials,
              radius: radius,
              backgroundColor: bgColor,
              textColor: accentColor,
            ),
          ),
        ),
      );
    }

    return _InitialsAvatar(
      initials: initials,
      radius: radius,
      backgroundColor: bgColor,
      textColor: accentColor,
    );
  }

  String _getInitials(String? name) {
    if (name == null || name.trim().isEmpty) return '?';
    final parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }
}

class _InitialsAvatar extends StatelessWidget {
  final String initials;
  final double radius;
  final Color backgroundColor;
  final Color textColor;

  const _InitialsAvatar({
    required this.initials,
    required this.radius,
    required this.backgroundColor,
    required this.textColor,
  });

  @override
  Widget build(BuildContext context) {
    return CircleAvatar(
      radius: radius,
      backgroundColor: backgroundColor,
      child: Text(
        initials,
        style: TextStyle(
          color: textColor,
          fontSize: radius * 0.7,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

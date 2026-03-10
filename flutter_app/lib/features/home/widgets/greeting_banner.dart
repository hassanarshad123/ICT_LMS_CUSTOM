import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/utils/date_formatter.dart';
import '../../../providers/auth_provider.dart';
import '../../../shared/widgets/avatar_widget.dart';

/// Dark gradient card showing "Hi, {name}" with a greeting based on time of day.
///
/// Includes user avatar and a decorative search icon (placeholder for future search).
class GreetingBanner extends ConsumerWidget {
  const GreetingBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final userName = authState.user?.name ?? 'Student';
    final avatarUrl = authState.user?.avatarUrl;
    final accentColor = Theme.of(context).colorScheme.primary;
    final greeting = getGreeting();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              accentColor.withValues(alpha: 0.12),
              AppColors.cardBg,
            ],
          ),
        ),
        child: Row(
          children: [
            // Avatar
            AvatarWidget(
              imageUrl: avatarUrl,
              name: userName,
              radius: 24,
            ),
            const SizedBox(width: 16),

            // Greeting text
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Hi, $userName',
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    greeting,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),

            // Search icon (placeholder for future feature)
            IconButton(
              onPressed: () {
                // Future: navigate to search screen
              },
              icon: Icon(
                Icons.search_rounded,
                color: AppColors.textSecondary,
                size: 24,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

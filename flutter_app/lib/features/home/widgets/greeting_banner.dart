import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/date_formatter.dart';
import '../../../providers/auth_provider.dart';
import '../../../shared/widgets/avatar_widget.dart';

/// Apple-style greeting banner — left-aligned large title with date below.
class GreetingBanner extends ConsumerWidget {
  const GreetingBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final userName = authState.user?.name ?? 'Student';
    final avatarUrl = authState.user?.avatarUrl;
    final greeting = getGreeting();
    final today = DateFormat('EEEE, MMMM d').format(DateTime.now());

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.screenH),
      child: Row(
        children: [
          // Greeting text — left-aligned large title
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$greeting,',
                  style: AppTextStyles.largeTitle,
                ),
                Text(
                  userName,
                  style: AppTextStyles.largeTitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: AppSpacing.space4),
                Text(
                  today,
                  style: AppTextStyles.subheadline,
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.space12),

          // Avatar
          AvatarWidget(
            imageUrl: avatarUrl,
            name: userName,
            radius: 24,
          ),
        ],
      ),
    );
  }
}

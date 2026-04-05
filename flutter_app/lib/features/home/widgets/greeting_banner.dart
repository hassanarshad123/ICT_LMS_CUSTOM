import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/date_formatter.dart';
import '../../../core/utils/responsive.dart';
import '../../../providers/auth_provider.dart';
import '../../../shared/widgets/avatar_widget.dart';

/// Dark gradient greeting banner — creates visual contrast with white cards below.
class GreetingBanner extends ConsumerWidget {
  const GreetingBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final userName = authState.user?.name ?? 'Student';
    final avatarUrl = authState.user?.avatarUrl;
    final greeting = getGreeting();
    final today = DateFormat('EEEE, MMMM d').format(DateTime.now());
    final accent = Theme.of(context).colorScheme.primary;

    final hPad = Responsive.screenPadding(context);

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.headerDark,
            HSLColor.fromColor(accent).withLightness(0.15).toColor(),
          ],
        ),
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(24),
          bottomRight: Radius.circular(24),
        ),
      ),
      padding: EdgeInsets.fromLTRB(hPad, AppSpacing.space16, hPad, AppSpacing.space24),
      child: SafeArea(
        bottom: false,
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$greeting,',
                    style: AppTextStyles.title1.copyWith(
                      color: AppColors.textOnDark,
                    ),
                  ),
                  Text(
                    userName,
                    style: AppTextStyles.title1.copyWith(
                      color: AppColors.textOnDark,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: AppSpacing.space4),
                  Text(
                    today,
                    style: AppTextStyles.subheadline.copyWith(
                      color: AppColors.textOnDarkSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.space12),
            AvatarWidget(
              imageUrl: avatarUrl,
              name: userName,
              radius: 24,
            ),
          ],
        ),
      ),
    );
  }
}

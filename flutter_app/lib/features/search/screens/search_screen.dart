import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_shadows.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/features/search/providers/search_provider.dart';
import 'package:ict_lms_student/models/search_result.dart';

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onQueryChanged(String query) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      ref.read(searchProvider.notifier).search(query);
    });
  }

  void _onClear() {
    _controller.clear();
    ref.read(searchProvider.notifier).clear();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(searchProvider);
    final accentColor = Theme.of(context).colorScheme.primary;

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      body: SafeArea(
        child: Column(
          children: [
            // Search bar area with white background.
            Container(
              color: AppColors.cardBg,
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.screenH,
                AppSpacing.space8,
                AppSpacing.screenH,
                AppSpacing.space12,
              ),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () => Navigator.of(context).pop(),
                    child: const Padding(
                      padding: EdgeInsets.only(right: AppSpacing.space12),
                      child: Icon(
                        Icons.arrow_back_ios_new,
                        color: AppColors.textPrimary,
                        size: 20,
                      ),
                    ),
                  ),
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      autofocus: true,
                      onChanged: _onQueryChanged,
                      style: AppTextStyles.body,
                      decoration: InputDecoration(
                        hintText: 'Search courses, batches, announcements...',
                        hintStyle: AppTextStyles.subheadline.copyWith(
                          color: AppColors.textTertiary,
                        ),
                        prefixIcon: const Icon(Icons.search,
                            color: AppColors.textTertiary, size: 20),
                        suffixIcon: _controller.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear,
                                    color: AppColors.textTertiary, size: 18),
                                onPressed: _onClear,
                              )
                            : null,
                        filled: true,
                        fillColor: AppColors.inputBg,
                        border: OutlineInputBorder(
                          borderRadius:
                              BorderRadius.circular(AppSpacing.inputRadius),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.space16,
                          vertical: AppSpacing.space12,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Results area
            Expanded(
              child: state.isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : state.error != null
                      ? _ErrorView(
                          error: state.error!,
                          onRetry: () => ref
                              .read(searchProvider.notifier)
                              .search(state.query),
                        )
                      : state.results == null
                          ? _EmptyPrompt()
                          : state.results!.isEmpty
                              ? _NoResults(query: state.query)
                              : _ResultsList(
                                  results: state.results!,
                                  accentColor: accentColor,
                                ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyPrompt extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.search, size: 64, color: AppColors.textTertiary),
          const SizedBox(height: AppSpacing.space16),
          Text('Start typing to search', style: AppTextStyles.callout),
        ],
      ),
    );
  }
}

class _NoResults extends StatelessWidget {
  final String query;

  const _NoResults({required this.query});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search_off, size: 64, color: AppColors.textTertiary),
            const SizedBox(height: AppSpacing.space16),
            Text(
              'No results for "$query"',
              style: AppTextStyles.callout,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String error;
  final VoidCallback onRetry;

  const _ErrorView({required this.error, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, color: AppColors.error, size: 48),
            const SizedBox(height: AppSpacing.space16),
            Text(error, style: AppTextStyles.subheadline,
                textAlign: TextAlign.center),
            const SizedBox(height: AppSpacing.space16),
            TextButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}

class _ResultsList extends StatelessWidget {
  final SearchResult results;
  final Color accentColor;

  const _ResultsList({required this.results, required this.accentColor});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.screenH,
        AppSpacing.space8,
        AppSpacing.screenH,
        80,
      ),
      children: [
        if (results.courses.isNotEmpty) ...[
          _SectionHeader(title: 'COURSES'),
          _ResultsGroup(
            items: results.courses,
            icon: Icons.book_outlined,
            accentColor: accentColor,
            onItemTap: (item) => context.push('/courses/${item.id}'),
          ),
          const SizedBox(height: AppSpacing.space16),
        ],
        if (results.batches.isNotEmpty) ...[
          _SectionHeader(title: 'BATCHES'),
          _ResultsGroup(
            items: results.batches,
            icon: Icons.school_outlined,
            accentColor: accentColor,
            onItemTap: (_) {},
          ),
          const SizedBox(height: AppSpacing.space16),
        ],
        if (results.announcements.isNotEmpty) ...[
          _SectionHeader(title: 'ANNOUNCEMENTS'),
          _ResultsGroup(
            items: results.announcements,
            icon: Icons.campaign_outlined,
            accentColor: accentColor,
            onItemTap: (_) => context.push('/profile/announcements'),
          ),
        ],
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;

  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(
        top: AppSpacing.space12,
        bottom: AppSpacing.space8,
      ),
      child: Text(title, style: AppTextStyles.overline),
    );
  }
}

class _ResultsGroup extends StatelessWidget {
  final List<SearchItem> items;
  final IconData icon;
  final Color accentColor;
  final void Function(SearchItem) onItemTap;

  const _ResultsGroup({
    required this.items,
    required this.icon,
    required this.accentColor,
    required this.onItemTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
        boxShadow: AppShadows.sm,
      ),
      child: Column(
        children: [
          for (int i = 0; i < items.length; i++) ...[
            _SearchResultTile(
              item: items[i],
              icon: icon,
              accentColor: accentColor,
              onTap: () => onItemTap(items[i]),
              isFirst: i == 0,
              isLast: i == items.length - 1,
            ),
            if (i < items.length - 1)
              const Divider(
                height: 1,
                indent: AppSpacing.space16 + 36 + AppSpacing.space12,
                endIndent: AppSpacing.space16,
                color: AppColors.border,
              ),
          ],
        ],
      ),
    );
  }
}

class _SearchResultTile extends StatelessWidget {
  final SearchItem item;
  final IconData icon;
  final Color accentColor;
  final VoidCallback onTap;
  final bool isFirst;
  final bool isLast;

  const _SearchResultTile({
    required this.item,
    required this.icon,
    required this.accentColor,
    required this.onTap,
    this.isFirst = false,
    this.isLast = false,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.vertical(
          top: isFirst ? const Radius.circular(AppSpacing.cardRadius) : Radius.zero,
          bottom: isLast ? const Radius.circular(AppSpacing.cardRadius) : Radius.zero,
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.space16,
            vertical: AppSpacing.space12,
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: accentColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: accentColor, size: 18),
              ),
              const SizedBox(width: AppSpacing.space12),
              Expanded(
                child: Text(
                  item.title,
                  style: AppTextStyles.body.copyWith(
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const Icon(
                Icons.chevron_right,
                color: AppColors.textTertiary,
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

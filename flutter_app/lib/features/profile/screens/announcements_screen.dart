import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/data/repositories/announcement_repository.dart';
import 'package:ict_lms_student/models/announcement_out.dart';
import 'package:ict_lms_student/shared/widgets/status_badge.dart';
import 'package:intl/intl.dart';

// --- Provider ---

class AnnouncementsState {
  final List<AnnouncementOut> items;
  final int page;
  final int totalPages;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;

  const AnnouncementsState({
    this.items = const [],
    this.page = 1,
    this.totalPages = 0,
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
  });

  bool get hasMore => page < totalPages;

  AnnouncementsState copyWith({
    List<AnnouncementOut>? items,
    int? page,
    int? totalPages,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    bool clearError = false,
  }) {
    return AnnouncementsState(
      items: items ?? this.items,
      page: page ?? this.page,
      totalPages: totalPages ?? this.totalPages,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class AnnouncementsNotifier extends StateNotifier<AnnouncementsState> {
  final AnnouncementRepository _repo;

  AnnouncementsNotifier(this._repo) : super(const AnnouncementsState()) {
    load();
  }

  Future<void> load() async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final result = await _repo.listAnnouncements(page: 1, perPage: 20);
      state = state.copyWith(
        items: result['data'] as List<AnnouncementOut>,
        page: result['page'] as int,
        totalPages: result['totalPages'] as int,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  Future<void> loadMore() async {
    if (!state.hasMore || state.isLoadingMore) return;

    state = state.copyWith(isLoadingMore: true);

    try {
      final nextPage = state.page + 1;
      final result =
          await _repo.listAnnouncements(page: nextPage, perPage: 20);

      final newItems = result['data'] as List<AnnouncementOut>;
      state = state.copyWith(
        items: [...state.items, ...newItems],
        page: result['page'] as int,
        totalPages: result['totalPages'] as int,
        isLoadingMore: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoadingMore: false,
        error: e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  Future<void> refresh() async {
    await load();
  }
}

final announcementsProvider = StateNotifierProvider.autoDispose<
    AnnouncementsNotifier, AnnouncementsState>((ref) {
  final repo = ref.watch(announcementRepositoryProvider);
  return AnnouncementsNotifier(repo);
});

// --- Screen ---

class AnnouncementsScreen extends ConsumerStatefulWidget {
  const AnnouncementsScreen({super.key});

  @override
  ConsumerState<AnnouncementsScreen> createState() =>
      _AnnouncementsScreenState();
}

class _AnnouncementsScreenState extends ConsumerState<AnnouncementsScreen> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref.read(announcementsProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(announcementsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Announcements'),
      ),
      body: _buildBody(state),
    );
  }

  Widget _buildBody(AnnouncementsState state) {
    if (state.isLoading && state.items.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (state.error != null && state.items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline,
                color: AppColors.error, size: 48),
            const SizedBox(height: 16),
            Text(
              state.error!,
              style: const TextStyle(color: AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: () =>
                  ref.read(announcementsProvider.notifier).refresh(),
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (state.items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.campaign_outlined,
                color: AppColors.textTertiary, size: 64),
            const SizedBox(height: 16),
            const Text(
              'No announcements',
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 16,
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => ref.read(announcementsProvider.notifier).refresh(),
      child: ListView.builder(
        controller: _scrollController,
        padding: const EdgeInsets.all(16),
        itemCount: state.items.length + (state.isLoadingMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index == state.items.length) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: CircularProgressIndicator(),
              ),
            );
          }

          final announcement = state.items[index];
          return _AnnouncementCard(announcement: announcement);
        },
      ),
    );
  }
}

class _AnnouncementCard extends StatefulWidget {
  final AnnouncementOut announcement;

  const _AnnouncementCard({required this.announcement});

  @override
  State<_AnnouncementCard> createState() => _AnnouncementCardState();
}

class _AnnouncementCardState extends State<_AnnouncementCard> {
  bool _isExpanded = false;

  @override
  Widget build(BuildContext context) {
    final announcement = widget.announcement;
    final accentColor = Theme.of(context).colorScheme.primary;

    return Card(
      color: AppColors.cardBg,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: announcement.isExpired
            ? BorderSide(
                color: AppColors.textTertiary.withValues(alpha: 0.2), width: 1)
            : BorderSide.none,
      ),
      child: InkWell(
        onTap: () => setState(() => _isExpanded = !_isExpanded),
        borderRadius: BorderRadius.circular(16),
        splashColor: accentColor.withValues(alpha: 0.1),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Title + scope badge.
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: AppColors.warning.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.campaign,
                      color: AppColors.warning,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          announcement.title,
                          style: TextStyle(
                            color: announcement.isExpired
                                ? AppColors.textTertiary
                                : AppColors.textPrimary,
                            fontWeight: FontWeight.w600,
                            fontSize: 15,
                          ),
                          maxLines: _isExpanded ? null : 2,
                          overflow: _isExpanded ? null : TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            StatusBadge(
                                status: announcement.scope, fontSize: 10),
                            if (announcement.isExpired) ...[
                              const SizedBox(width: 8),
                              const StatusBadge(
                                  status: 'expired', fontSize: 10),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              // Content.
              Text(
                announcement.content,
                style: TextStyle(
                  color: announcement.isExpired
                      ? AppColors.textTertiary
                      : AppColors.textSecondary,
                  fontSize: 14,
                  height: 1.5,
                ),
                maxLines: _isExpanded ? null : 3,
                overflow: _isExpanded ? null : TextOverflow.ellipsis,
              ),
              const SizedBox(height: 10),
              // Footer: posted by + date.
              Row(
                children: [
                  if (announcement.postedByName != null) ...[
                    const Icon(Icons.person_outline,
                        size: 13, color: AppColors.textTertiary),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        announcement.postedByName!,
                        style: const TextStyle(
                          color: AppColors.textTertiary,
                          fontSize: 12,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 12),
                  ],
                  if (announcement.createdAt != null) ...[
                    const Icon(Icons.access_time,
                        size: 13, color: AppColors.textTertiary),
                    const SizedBox(width: 4),
                    Text(
                      DateFormat('MMM d, yyyy')
                          .format(announcement.createdAt!),
                      style: const TextStyle(
                        color: AppColors.textTertiary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                  const Spacer(),
                  Icon(
                    _isExpanded
                        ? Icons.keyboard_arrow_up
                        : Icons.keyboard_arrow_down,
                    color: AppColors.textTertiary,
                    size: 20,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'empty_state.dart';
import 'page_error.dart';
import 'loading_indicator.dart';

class PaginatedListView<T> extends StatefulWidget {
  final List<T> items;
  final Widget Function(BuildContext context, T item, int index) itemBuilder;
  final bool isLoading;
  final bool isLoadingMore;
  final bool hasMore;
  final VoidCallback? onLoadMore;
  final Future<void> Function()? onRefresh;
  final String? emptyMessage;
  final IconData? emptyIcon;
  final String? errorMessage;
  final VoidCallback? onRetry;
  final EdgeInsetsGeometry? padding;
  final Widget? header;
  final double? itemExtent;
  final ScrollPhysics? physics;

  const PaginatedListView({
    super.key,
    required this.items,
    required this.itemBuilder,
    this.isLoading = false,
    this.isLoadingMore = false,
    this.hasMore = false,
    this.onLoadMore,
    this.onRefresh,
    this.emptyMessage,
    this.emptyIcon,
    this.errorMessage,
    this.onRetry,
    this.padding,
    this.header,
    this.itemExtent,
    this.physics,
  });

  @override
  State<PaginatedListView<T>> createState() => _PaginatedListViewState<T>();
}

class _PaginatedListViewState<T> extends State<PaginatedListView<T>> {
  late final ScrollController _scrollController;

  @override
  void initState() {
    super.initState();
    _scrollController = ScrollController();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final maxScroll = _scrollController.position.maxScrollExtent;
    final currentScroll = _scrollController.offset;
    final threshold = maxScroll * 0.8;

    if (currentScroll >= threshold &&
        widget.hasMore &&
        !widget.isLoadingMore &&
        widget.onLoadMore != null) {
      widget.onLoadMore!();
    }
  }

  @override
  Widget build(BuildContext context) {
    // Initial loading state
    if (widget.isLoading && widget.items.isEmpty) {
      return const LoadingIndicator();
    }

    // Error state with no items
    if (widget.errorMessage != null && widget.items.isEmpty) {
      return PageError(
        message: widget.errorMessage!,
        onRetry: widget.onRetry,
      );
    }

    // Empty state
    if (!widget.isLoading && widget.items.isEmpty) {
      return EmptyState(
        title: widget.emptyMessage ?? 'Nothing here yet',
        icon: widget.emptyIcon ?? Icons.inbox_rounded,
      );
    }

    // Calculate total count including header and loading footer
    final hasHeader = widget.header != null;
    final headerCount = hasHeader ? 1 : 0;
    final footerCount = widget.isLoadingMore ? 1 : 0;
    final totalCount = headerCount + widget.items.length + footerCount;

    Widget listView = ListView.builder(
      controller: _scrollController,
      physics: widget.physics ?? const AlwaysScrollableScrollPhysics(),
      padding: widget.padding ?? const EdgeInsets.all(16),
      itemCount: totalCount,
      itemExtent: widget.itemExtent,
      itemBuilder: (context, index) {
        // Header
        if (hasHeader && index == 0) {
          return widget.header!;
        }

        // Adjust index for header
        final itemIndex = index - headerCount;

        // Loading footer
        if (itemIndex >= widget.items.length) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: LoadingIndicator(size: 24, strokeWidth: 2),
          );
        }

        return widget.itemBuilder(context, widget.items[itemIndex], itemIndex);
      },
    );

    // Wrap with RefreshIndicator if onRefresh is provided
    if (widget.onRefresh != null) {
      listView = RefreshIndicator(
        onRefresh: widget.onRefresh!,
        color: Theme.of(context).colorScheme.primary,
        child: listView,
      );
    }

    return listView;
  }
}

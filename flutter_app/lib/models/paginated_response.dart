/// Generic paginated response matching backend/app/schemas/common.py PaginatedResponse.
class PaginatedResponse<T> {
  final List<T> data;
  final int total;
  final int page;
  final int perPage;
  final int totalPages;

  const PaginatedResponse({
    required this.data,
    required this.total,
    required this.page,
    required this.perPage,
    required this.totalPages,
  });

  factory PaginatedResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic> json) fromJsonT,
  ) {
    return PaginatedResponse<T>(
      data: (json['data'] as List<dynamic>?)
              ?.map((e) => fromJsonT(e as Map<String, dynamic>))
              .toList() ??
          [],
      total: json['total'] as int? ?? 0,
      page: json['page'] as int? ?? 1,
      perPage: json['perPage'] as int? ?? 20,
      totalPages: json['totalPages'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson(Map<String, dynamic> Function(T value) toJsonT) {
    return {
      'data': data.map(toJsonT).toList(),
      'total': total,
      'page': page,
      'perPage': perPage,
      'totalPages': totalPages,
    };
  }

  bool get hasMore => page < totalPages;

  bool get isEmpty => data.isEmpty;

  bool get isNotEmpty => data.isNotEmpty;

  @override
  String toString() =>
      'PaginatedResponse(page: $page/$totalPages, total: $total, items: ${data.length})';
}

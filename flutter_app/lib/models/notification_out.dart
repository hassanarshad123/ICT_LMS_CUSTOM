/// Matches NotificationOut from backend/app/schemas/notification.py.
class NotificationOut {
  final String id;
  final String type;
  final String title;
  final String message;
  final String? link;
  final bool read;
  final DateTime? createdAt;

  const NotificationOut({
    required this.id,
    required this.type,
    required this.title,
    required this.message,
    this.link,
    this.read = false,
    this.createdAt,
  });

  factory NotificationOut.fromJson(Map<String, dynamic> json) {
    return NotificationOut(
      id: json['id']?.toString() ?? '',
      type: json['type'] as String? ?? '',
      title: json['title'] as String? ?? '',
      message: json['message'] as String? ?? '',
      link: json['link'] as String?,
      read: json['read'] as bool? ?? false,
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'type': type,
      'title': title,
      'message': message,
      'link': link,
      'read': read,
      'createdAt': createdAt?.toIso8601String(),
    };
  }

  NotificationOut copyWith({
    String? id,
    String? type,
    String? title,
    String? message,
    String? link,
    bool? read,
    DateTime? createdAt,
  }) {
    return NotificationOut(
      id: id ?? this.id,
      type: type ?? this.type,
      title: title ?? this.title,
      message: message ?? this.message,
      link: link ?? this.link,
      read: read ?? this.read,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  /// Whether the notification is unread.
  bool get isUnread => !read;

  @override
  String toString() =>
      'NotificationOut(id: $id, title: $title, read: $read)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is NotificationOut &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;
}

/// Matches UnreadCountOut from backend/app/schemas/notification.py.
class UnreadCountOut {
  final int count;

  const UnreadCountOut({required this.count});

  factory UnreadCountOut.fromJson(Map<String, dynamic> json) {
    return UnreadCountOut(
      count: json['count'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'count': count,
    };
  }

  @override
  String toString() => 'UnreadCountOut(count: $count)';
}

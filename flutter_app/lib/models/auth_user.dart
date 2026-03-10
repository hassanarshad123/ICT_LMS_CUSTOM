/// Matches UserBrief from backend/app/schemas/auth.py.
/// Field names are camelCase -- Dio interceptor converts from snake_case.
class AuthUser {
  final String id;
  final String email;
  final String name;
  final String? phone;
  final String role;
  final String status;
  final String? avatarUrl;
  final List<String> batchIds;
  final List<String> batchNames;
  final String? instituteId;
  final String? instituteSlug;

  const AuthUser({
    required this.id,
    required this.email,
    required this.name,
    this.phone,
    required this.role,
    this.status = 'active',
    this.avatarUrl,
    this.batchIds = const [],
    this.batchNames = const [],
    this.instituteId,
    this.instituteSlug,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id']?.toString() ?? '',
      email: json['email'] as String? ?? '',
      name: json['name'] as String? ?? '',
      phone: json['phone'] as String?,
      role: json['role'] as String? ?? 'student',
      status: json['status'] as String? ?? 'active',
      avatarUrl: json['avatarUrl'] as String?,
      batchIds: (json['batchIds'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      batchNames: (json['batchNames'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      instituteId: json['instituteId']?.toString(),
      instituteSlug: json['instituteSlug'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'name': name,
      'phone': phone,
      'role': role,
      'status': status,
      'avatarUrl': avatarUrl,
      'batchIds': batchIds,
      'batchNames': batchNames,
      'instituteId': instituteId,
      'instituteSlug': instituteSlug,
    };
  }

  AuthUser copyWith({
    String? id,
    String? email,
    String? name,
    String? phone,
    String? role,
    String? status,
    String? avatarUrl,
    List<String>? batchIds,
    List<String>? batchNames,
    String? instituteId,
    String? instituteSlug,
  }) {
    return AuthUser(
      id: id ?? this.id,
      email: email ?? this.email,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      role: role ?? this.role,
      status: status ?? this.status,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      batchIds: batchIds ?? this.batchIds,
      batchNames: batchNames ?? this.batchNames,
      instituteId: instituteId ?? this.instituteId,
      instituteSlug: instituteSlug ?? this.instituteSlug,
    );
  }

  @override
  String toString() => 'AuthUser(id: $id, email: $email, name: $name, role: $role)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AuthUser && runtimeType == other.runtimeType && id == other.id;

  @override
  int get hashCode => id.hashCode;
}

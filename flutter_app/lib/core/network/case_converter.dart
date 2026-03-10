/// Converts a camelCase string to snake_case.
String camelToSnake(String input) {
  return input.replaceAllMapped(
    RegExp(r'[A-Z]'),
    (match) => '_${match.group(0)!.toLowerCase()}',
  );
}

/// Converts a snake_case string to camelCase.
String snakeToCamel(String input) {
  return input.replaceAllMapped(
    RegExp(r'_([a-z])'),
    (match) => match.group(1)!.toUpperCase(),
  );
}

/// Recursively converts all keys in a Map/List from camelCase to snake_case.
/// Returns Map<String, dynamic> (not Map<dynamic, dynamic>).
dynamic convertKeysToSnake(dynamic data) {
  if (data is Map) {
    return Map<String, dynamic>.fromEntries(
      data.entries.map((e) {
        final newKey = e.key is String ? camelToSnake(e.key as String) : '${e.key}';
        return MapEntry(newKey, convertKeysToSnake(e.value));
      }),
    );
  } else if (data is List) {
    return data.map(convertKeysToSnake).toList();
  }
  return data;
}

/// Recursively converts all keys in a Map/List from snake_case to camelCase.
/// Returns Map<String, dynamic> (not Map<dynamic, dynamic>).
dynamic convertKeysToCamel(dynamic data) {
  if (data is Map) {
    return Map<String, dynamic>.fromEntries(
      data.entries.map((e) {
        final newKey = e.key is String ? snakeToCamel(e.key as String) : '${e.key}';
        return MapEntry(newKey, convertKeysToCamel(e.value));
      }),
    );
  } else if (data is List) {
    return data.map(convertKeysToCamel).toList();
  }
  return data;
}

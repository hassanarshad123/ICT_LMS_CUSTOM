import 'package:flutter/material.dart';

/// Formats bytes into a human-readable string (B, KB, MB, GB).
String formatFileSize(int? bytes) {
  if (bytes == null || bytes <= 0) return '0 B';
  const suffixes = ['B', 'KB', 'MB', 'GB'];
  int i = 0;
  double size = bytes.toDouble();
  while (size >= 1024 && i < suffixes.length - 1) {
    size /= 1024;
    i++;
  }
  return '${size.toStringAsFixed(size < 10 ? 1 : 0)} ${suffixes[i]}';
}

/// Returns an icon for a given file type string.
/// File types match MaterialFileType enum: pdf, excel, word, pptx, image, archive, other.
IconData getFileTypeIcon(String? fileType) {
  return switch (fileType) {
    'pdf' => Icons.picture_as_pdf,
    'excel' => Icons.table_chart,
    'word' => Icons.description,
    'pptx' => Icons.slideshow,
    'image' => Icons.image,
    'archive' => Icons.folder_zip,
    _ => Icons.insert_drive_file,
  };
}

/// Returns a color for a given file type string.
Color getFileTypeColor(String? fileType) {
  return switch (fileType) {
    'pdf' => const Color(0xFFEF4444),
    'excel' => const Color(0xFF22C55E),
    'word' => const Color(0xFF3B82F6),
    'pptx' => const Color(0xFFF59E0B),
    'image' => const Color(0xFF8B5CF6),
    'archive' => const Color(0xFF6B7280),
    _ => const Color(0xFF9CA3AF),
  };
}

/// Returns the file extension from a filename.
String getFileExtension(String fileName) {
  final lastDot = fileName.lastIndexOf('.');
  if (lastDot == -1 || lastDot == fileName.length - 1) return '';
  return fileName.substring(lastDot + 1).toLowerCase();
}

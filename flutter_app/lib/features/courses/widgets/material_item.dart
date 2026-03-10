import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:path_provider/path_provider.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/data/repositories/material_repository.dart';
import 'package:ict_lms_student/models/material_out.dart';
import 'package:url_launcher/url_launcher.dart';

class MaterialItem extends ConsumerStatefulWidget {
  final MaterialOut material;

  const MaterialItem({
    super.key,
    required this.material,
  });

  @override
  ConsumerState<MaterialItem> createState() => _MaterialItemState();
}

class _MaterialItemState extends ConsumerState<MaterialItem> {
  bool _isDownloading = false;
  double _downloadProgress = 0;

  IconData _fileIcon(String fileType) {
    return switch (fileType.toLowerCase()) {
      'pdf' => Icons.picture_as_pdf,
      'doc' || 'docx' => Icons.description,
      'xls' || 'xlsx' => Icons.table_chart,
      'ppt' || 'pptx' => Icons.slideshow,
      'zip' || 'rar' || '7z' => Icons.folder_zip,
      'jpg' || 'jpeg' || 'png' || 'gif' || 'webp' => Icons.image,
      'mp4' || 'avi' || 'mov' || 'mkv' => Icons.video_file,
      'mp3' || 'wav' || 'aac' => Icons.audio_file,
      _ => Icons.insert_drive_file,
    };
  }

  Color _fileColor(String fileType) {
    return switch (fileType.toLowerCase()) {
      'pdf' => const Color(0xFFE53935),
      'doc' || 'docx' => const Color(0xFF1976D2),
      'xls' || 'xlsx' => const Color(0xFF388E3C),
      'ppt' || 'pptx' => const Color(0xFFE64A19),
      'zip' || 'rar' || '7z' => AppColors.warning,
      'jpg' || 'jpeg' || 'png' || 'gif' || 'webp' => const Color(0xFF7B1FA2),
      _ => AppColors.textTertiary,
    };
  }

  Future<void> _onDownload() async {
    if (_isDownloading) return;

    setState(() {
      _isDownloading = true;
      _downloadProgress = 0;
    });

    try {
      final repo = ref.read(materialRepositoryProvider);
      final downloadResponse = await repo.getDownloadUrl(widget.material.id);
      final downloadUrl = downloadResponse.downloadUrl;

      if (downloadUrl.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Download URL not available'),
              backgroundColor: AppColors.error,
            ),
          );
        }
        return;
      }

      // Download the file to a temporary directory.
      final tempDir = await getTemporaryDirectory();
      final fileName = widget.material.fileName.isNotEmpty
          ? widget.material.fileName
          : 'download_${widget.material.id}';
      final filePath = '${tempDir.path}/$fileName';

      final dio = Dio();
      await dio.download(
        downloadUrl,
        filePath,
        onReceiveProgress: (received, total) {
          if (total > 0 && mounted) {
            setState(() {
              _downloadProgress = received / total;
            });
          }
        },
      );

      if (!mounted) return;

      // For PDF files, open the in-app PDF viewer.
      if (widget.material.fileType.toLowerCase() == 'pdf') {
        context.push('/pdf-viewer', extra: {
          'filePath': filePath,
          'fileName': widget.material.title,
        });
      } else {
        // For other files, try to open with system handler.
        final uri = Uri.file(filePath);
        try {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        } catch (_) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Could not open file'),
                backgroundColor: AppColors.error,
              ),
            );
          }
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Download failed: ${e.toString().replaceFirst("Exception: ", "")}'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isDownloading = false;
          _downloadProgress = 0;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final material = widget.material;
    final accentColor = Theme.of(context).colorScheme.primary;
    final iconColor = _fileColor(material.fileType);

    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
      leading: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: iconColor.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(
          _fileIcon(material.fileType),
          color: iconColor,
          size: 24,
        ),
      ),
      title: Text(
        material.title,
        style: const TextStyle(
          color: AppColors.textPrimary,
          fontWeight: FontWeight.w500,
          fontSize: 15,
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Row(
        children: [
          Flexible(
            child: Text(
              material.fileName,
              style: const TextStyle(
                color: AppColors.textTertiary,
                fontSize: 12,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (material.fileSize != null && material.fileSize!.isNotEmpty) ...[
            const SizedBox(width: 8),
            Text(
              material.fileSize!,
              style: const TextStyle(
                color: AppColors.textTertiary,
                fontSize: 12,
              ),
            ),
          ],
        ],
      ),
      trailing: _isDownloading
          ? SizedBox(
              width: 32,
              height: 32,
              child: CircularProgressIndicator(
                value: _downloadProgress > 0 ? _downloadProgress : null,
                strokeWidth: 2,
                color: accentColor,
              ),
            )
          : IconButton(
              icon: Icon(
                Icons.download_rounded,
                color: accentColor,
              ),
              onPressed: _onDownload,
              tooltip: 'Download',
            ),
    );
  }
}

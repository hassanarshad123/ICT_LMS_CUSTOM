import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../core/constants/app_colors.dart';

class VideoPlayerWebView extends StatefulWidget {
  final String signedUrl;
  final String userEmail;
  final String videoType;

  const VideoPlayerWebView({
    super.key,
    required this.signedUrl,
    required this.userEmail,
    this.videoType = 'bunny_embed',
  });

  @override
  State<VideoPlayerWebView> createState() => _VideoPlayerWebViewState();
}

class _VideoPlayerWebViewState extends State<VideoPlayerWebView> {
  late final WebViewController _controller;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(AppColors.scaffoldBg)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) {
            if (mounted) {
              setState(() => _isLoading = true);
            }
          },
          onPageFinished: (_) {
            if (mounted) {
              setState(() => _isLoading = false);
            }
          },
          onWebResourceError: (error) {
            debugPrint('WebView error: ${error.description}');
          },
        ),
      )
      ..loadRequest(
        Uri.parse(widget.signedUrl),
        headers: {'Referer': 'https://zensbot.online/'},
      );
  }

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 16 / 9,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Stack(
          children: [
            // WebView player — loads Bunny embed URL directly
            WebViewWidget(controller: _controller),

            // Loading overlay
            if (_isLoading)
              Container(
                color: AppColors.scaffoldBg,
                child: Center(
                  child: CircularProgressIndicator(
                    color: Theme.of(context).colorScheme.primary,
                    strokeWidth: 2,
                  ),
                ),
              ),

            // Watermark overlay
            Positioned.fill(
              child: IgnorePointer(
                child: _WatermarkOverlay(email: widget.userEmail),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _WatermarkOverlay extends StatelessWidget {
  final String email;

  const _WatermarkOverlay({required this.email});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final height = constraints.maxHeight;

        final cols = (width / 200).ceil();
        final rows = (height / 100).ceil();

        return Stack(
          children: [
            for (int row = 0; row < rows; row++)
              for (int col = 0; col < cols; col++)
                Positioned(
                  left: col * 200.0 + (row.isOdd ? 50 : 0),
                  top: row * 100.0,
                  child: Transform.rotate(
                    angle: -30 * math.pi / 180,
                    child: Opacity(
                      opacity: 0.15,
                      child: Text(
                        email,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          letterSpacing: 1,
                          decoration: TextDecoration.none,
                        ),
                      ),
                    ),
                  ),
                ),
          ],
        );
      },
    );
  }
}

import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../core/constants/app_colors.dart';
import '../../providers/fullscreen_provider.dart';

class VideoPlayerWebView extends ConsumerStatefulWidget {
  final String signedUrl;
  final String? userEmail;
  final String videoType;

  const VideoPlayerWebView({
    super.key,
    required this.signedUrl,
    // userEmail is nullable — pass null to hide watermark (admin toggle)
    required this.userEmail,
    this.videoType = 'bunny_embed',
  });

  @override
  ConsumerState<VideoPlayerWebView> createState() =>
      _VideoPlayerWebViewState();
}

class _VideoPlayerWebViewState extends ConsumerState<VideoPlayerWebView> {
  late final WebViewController _controller;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(AppColors.scaffoldBg)
      ..addJavaScriptChannel(
        'FlutterFullscreen',
        onMessageReceived: (JavaScriptMessage message) {
          final isFullscreen = message.message == 'true';
          final notifier = ref.read(fullscreenProvider.notifier);
          if (isFullscreen) {
            notifier.enterFullscreen();
          } else {
            notifier.exitFullscreen();
          }
        },
      )
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
            _injectFullscreenListener();
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

  void _injectFullscreenListener() {
    _controller.runJavaScript('''
      (function() {
        if (window._fsListenerAdded) return;
        window._fsListenerAdded = true;

        document.addEventListener('fullscreenchange', function() {
          var isFs = !!document.fullscreenElement;
          FlutterFullscreen.postMessage(isFs ? 'true' : 'false');
        });

        document.addEventListener('webkitfullscreenchange', function() {
          var isFs = !!document.webkitFullscreenElement;
          FlutterFullscreen.postMessage(isFs ? 'true' : 'false');
        });

        var videos = document.querySelectorAll('video');
        videos.forEach(function(v) {
          v.addEventListener('webkitbeginfullscreen', function() {
            FlutterFullscreen.postMessage('true');
          });
          v.addEventListener('webkitendfullscreen', function() {
            FlutterFullscreen.postMessage('false');
          });
        });
      })();
    ''');
  }

  @override
  void dispose() {
    if (ref.read(fullscreenProvider)) {
      ref.read(fullscreenProvider.notifier).exitFullscreen();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isFullscreen = ref.watch(fullscreenProvider);

    final player = ClipRRect(
      borderRadius: BorderRadius.circular(isFullscreen ? 0 : 12),
      child: Stack(
        children: [
          WebViewWidget(controller: _controller),

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

          if (widget.userEmail != null && widget.userEmail!.isNotEmpty)
            Positioned.fill(
              child: IgnorePointer(
                child: _WatermarkOverlay(email: widget.userEmail!),
              ),
            ),
        ],
      ),
    );

    if (isFullscreen) {
      return SizedBox.expand(child: player);
    }

    return AspectRatio(
      aspectRatio: 16 / 9,
      child: player,
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

        final cellW = width < 600 ? 180.0 : 240.0;
        final cellH = width < 600 ? 90.0 : 120.0;
        final cols = (width / cellW).ceil();
        final rows = (height / cellH).ceil();

        return Stack(
          children: [
            for (int row = 0; row < rows; row++)
              for (int col = 0; col < cols; col++)
                Positioned(
                  left: col * cellW + (row.isOdd ? 50 : 0),
                  top: row * cellH,
                  child: Transform.rotate(
                    angle: -25 * math.pi / 180,
                    child: Text(
                      email,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.25),
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1,
                        decoration: TextDecoration.none,
                        shadows: const [
                          Shadow(offset: Offset(1, 0), color: Color(0x4D000000)),
                          Shadow(offset: Offset(-1, 0), color: Color(0x4D000000)),
                          Shadow(offset: Offset(0, 1), color: Color(0x4D000000)),
                          Shadow(offset: Offset(0, -1), color: Color(0x4D000000)),
                        ],
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

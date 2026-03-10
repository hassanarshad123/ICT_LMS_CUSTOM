import 'dart:async';
import 'package:flutter/material.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import '../../core/constants/app_colors.dart';

class OfflineBanner extends StatefulWidget {
  final Widget child;

  const OfflineBanner({super.key, required this.child});

  @override
  State<OfflineBanner> createState() => _OfflineBannerState();
}

class _OfflineBannerState extends State<OfflineBanner> {
  late final Connectivity _connectivity;
  late StreamSubscription<List<ConnectivityResult>> _subscription;
  bool _isOffline = false;

  @override
  void initState() {
    super.initState();
    _connectivity = Connectivity();
    _checkConnectivity();
    _subscription = _connectivity.onConnectivityChanged.listen(_updateStatus);
  }

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }

  Future<void> _checkConnectivity() async {
    final result = await _connectivity.checkConnectivity();
    _updateStatus(result);
  }

  void _updateStatus(List<ConnectivityResult> results) {
    final offline = results.isEmpty ||
        results.every((r) => r == ConnectivityResult.none);
    if (mounted && offline != _isOffline) {
      setState(() => _isOffline = offline);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (_isOffline)
          MaterialBanner(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            content: const Row(
              children: [
                Icon(Icons.wifi_off_rounded, color: AppColors.warning, size: 20),
                SizedBox(width: 12),
                Text(
                  'No internet connection',
                  style: TextStyle(
                    color: AppColors.warning,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
            backgroundColor: AppColors.warning.withValues(alpha: 0.1),
            actions: [
              TextButton(
                onPressed: _checkConnectivity,
                child: const Text(
                  'Retry',
                  style: TextStyle(color: AppColors.warning),
                ),
              ),
            ],
          ),
        Expanded(child: widget.child),
      ],
    );
  }
}

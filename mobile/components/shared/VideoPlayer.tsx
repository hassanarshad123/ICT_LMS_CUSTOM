import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ActivityIndicator, Linking, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { getSignedUrl, getProgress, updateProgress } from '@/lib/api/lectures';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/lib/constants/colors';

interface VideoPlayerProps {
  lectureId: string;
  videoType: string;
  videoUrl?: string;
  videoStatus?: string;
  watermark?: string;
}

function toYouTubeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    let videoId: string | null = null;
    if (u.hostname.includes('youtube.com') && u.searchParams.has('v')) {
      videoId = u.searchParams.get('v');
    } else if (u.hostname === 'youtu.be') {
      videoId = u.pathname.slice(1);
    } else if (u.hostname.includes('youtube.com') && u.pathname.startsWith('/embed/')) {
      return url;
    }
    if (videoId) return `https://www.youtube.com/embed/${videoId}`;
  } catch {
    // Not a valid URL
  }
  return null;
}

function toVimeoEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('vimeo.com')) {
      const match = u.pathname.match(/\/(\d+)/);
      if (match) return `https://player.vimeo.com/video/${match[1]}`;
    }
  } catch {
    // Not a valid URL
  }
  return null;
}

export function VideoPlayer({ lectureId, videoType, videoUrl, videoStatus, watermark }: VideoPlayerProps) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlType, setUrlType] = useState('');
  const expiresAtRef = useRef<number | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReportedTimeRef = useRef(0);

  const fetchSignedUrl = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let resumeSeconds = 0;
      try {
        const prog = await getProgress(lectureId);
        if (prog.resumePositionSeconds > 0 && prog.status !== 'completed') {
          resumeSeconds = prog.resumePositionSeconds;
        }
      } catch {
        // No progress yet
      }

      const res = await getSignedUrl(lectureId);
      if (res.type === 'bunny_embed') {
        const url = resumeSeconds > 0 ? `${res.url}&t=${resumeSeconds}` : res.url;
        setEmbedUrl(url);
        setUrlType('bunny');
        if (res.expiresAt) {
          expiresAtRef.current = new Date(res.expiresAt).getTime();
        }
      } else if (res.type === 'external' && res.url) {
        const ytEmbed = toYouTubeEmbed(res.url);
        const vimeoEmbed = toVimeoEmbed(res.url);
        if (ytEmbed) {
          setEmbedUrl(ytEmbed);
          setUrlType('youtube');
        } else if (vimeoEmbed) {
          setEmbedUrl(vimeoEmbed);
          setUrlType('vimeo');
        } else {
          setEmbedUrl(res.url);
          setUrlType('link');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('403') || msg.includes('Not enrolled')) {
        setError('You are not enrolled in this batch.');
      } else if (msg.includes('409')) {
        setError('Video is still being processed.');
      } else {
        setError('Could not load video. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [lectureId]);

  useEffect(() => {
    setEmbedUrl(null);
    setError(null);
    setUrlType('');
    lastReportedTimeRef.current = 0;

    if (videoType === 'upload') {
      if (videoStatus !== 'ready') return;
      fetchSignedUrl();
    } else if (videoType === 'external' && videoUrl) {
      const ytEmbed = toYouTubeEmbed(videoUrl);
      const vimeoEmbed = toVimeoEmbed(videoUrl);
      if (ytEmbed) {
        setEmbedUrl(ytEmbed);
        setUrlType('youtube');
      } else if (vimeoEmbed) {
        setEmbedUrl(vimeoEmbed);
        setUrlType('vimeo');
      } else {
        setEmbedUrl(videoUrl);
        setUrlType('link');
      }
    }
  }, [lectureId, videoType, videoStatus, videoUrl, fetchSignedUrl]);

  // Auto-refresh signed URL before expiry
  useEffect(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (urlType !== 'bunny' || !embedUrl || !expiresAtRef.current) return;

    const msUntilExpiry = expiresAtRef.current - Date.now();
    const refreshIn = msUntilExpiry - 5 * 60 * 1000;
    if (refreshIn <= 0) return;

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const res = await getSignedUrl(lectureId);
        if (res.type === 'bunny_embed') {
          setEmbedUrl(res.url);
          if (res.expiresAt) {
            expiresAtRef.current = new Date(res.expiresAt).getTime();
          }
        }
      } catch {
        // Silently fail
      }
    }, refreshIn);

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [urlType, embedUrl, lectureId]);

  const handleWebViewMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.event === 'timeupdate' && msg.duration > 0) {
          const pct = Math.round((msg.currentTime / msg.duration) * 100);
          const now = msg.currentTime;
          if (now - lastReportedTimeRef.current >= 30 || pct >= 95) {
            lastReportedTimeRef.current = now;
            updateProgress(lectureId, {
              watchPercentage: Math.min(pct, 100),
              resumePositionSeconds: Math.round(msg.currentTime),
            }).catch(() => {});
          }
        }
      } catch {
        // Ignore non-JSON messages
      }
    },
    [lectureId],
  );

  // Injected JS to forward Bunny player events to React Native
  const injectedJS = urlType === 'bunny'
    ? `
      window.addEventListener('message', function(e) {
        if (e.data && typeof e.data === 'object') {
          window.ReactNativeWebView.postMessage(JSON.stringify(e.data));
        }
      });
      true;
    `
    : undefined;

  // Processing state
  if (videoType === 'upload' && videoStatus && videoStatus !== 'ready') {
    return (
      <View style={styles.placeholder}>
        {videoStatus === 'failed' ? (
          <View style={styles.centerContent}>
            <Ionicons name="alert-circle" size={48} color={Colors.error} />
            <Text style={styles.placeholderText}>Video processing failed</Text>
            <Text style={styles.placeholderSub}>Please contact your instructor</Text>
          </View>
        ) : (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.placeholderText}>Video is being processed...</Text>
            <Text style={styles.placeholderSub}>This may take a few minutes</Text>
          </View>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.placeholder}>
        <Ionicons name="warning" size={48} color={Colors.warning} />
        <Text style={styles.placeholderText}>{error}</Text>
        <Button title="Retry" onPress={fetchSignedUrl} variant="outline" icon="refresh-outline" style={styles.retryBtn} />
      </View>
    );
  }

  // External link (non-embeddable)
  if (urlType === 'link' && embedUrl) {
    return (
      <View style={styles.placeholder}>
        <Ionicons name="play-circle" size={64} color={Colors.accent} />
        <Button
          title="Open Video"
          onPress={() => Linking.openURL(embedUrl)}
          variant="primary"
          icon="open-outline"
          style={styles.retryBtn}
        />
      </View>
    );
  }

  // Iframe player (Bunny, YouTube, Vimeo)
  if (embedUrl) {
    const html = `
      <!DOCTYPE html>
      <html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: #000; }
          iframe { width: 100%; height: 100vh; border: none; }
        </style>
      </head><body>
        <iframe
          src="${embedUrl}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowfullscreen
        ></iframe>
      </body></html>
    `;

    return (
      <View style={styles.playerContainer}>
        <WebView
          source={{ html }}
          style={styles.webview}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          injectedJavaScript={injectedJS}
          onMessage={handleWebViewMessage}
          allowsFullscreenVideo
        />
        {watermark && (
          <View style={styles.watermarkOverlay} pointerEvents="none">
            <Text style={styles.watermarkText}>{watermark}</Text>
          </View>
        )}
      </View>
    );
  }

  // No video
  return (
    <View style={styles.placeholder}>
      <Ionicons name="play-circle" size={64} color={Colors.textTertiary} />
      <Text style={styles.placeholderText}>No video available</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    aspectRatio: 16 / 9,
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  centerContent: {
    alignItems: 'center',
  },
  placeholderText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  placeholderSub: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
  },
  retryBtn: {
    marginTop: 16,
  },
  playerContainer: {
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    borderRadius: 16,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  watermarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  watermarkText: {
    color: 'rgba(255, 255, 255, 0.15)',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 4,
  },
});

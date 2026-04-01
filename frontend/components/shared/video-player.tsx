'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getSignedUrl, getProgress, updateProgress } from '@/lib/api/lectures';
import { PlayCircle, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';

interface VideoPlayerProps {
  lectureId: string;
  videoType: string;
  videoUrl?: string;
  videoStatus?: string;
  /** Student identifier shown as anti-piracy watermark overlay */
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

function WatermarkOverlay({ text }: { text: string }) {
  const tiles = Array.from({ length: 6 });
  return (
    <div
      className="absolute inset-0 z-10 pointer-events-none overflow-hidden"
      style={{ userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
    >
      <div className="w-full h-full grid grid-cols-2 grid-rows-3">
        {tiles.map((_, i) => (
          <div key={i} className="flex items-center justify-center" style={{ transform: 'rotate(-25deg)' }}>
            <span
              className="text-white/10 text-sm sm:text-base md:text-lg font-bold font-mono tracking-widest whitespace-nowrap"
              style={{ textShadow: '0 0 4px rgba(0,0,0,0.3)' }}
            >
              {text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VideoPlayer({ lectureId, videoType, videoUrl, videoStatus, watermark }: VideoPlayerProps) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlType, setUrlType] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expiresAtRef = useRef<number | null>(null);
  const lastKnownTimeRef = useRef<number>(0);

  const fetchSignedUrl = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch resume position before loading the video
      let resumeSeconds = 0;
      try {
        const prog = await getProgress(lectureId);
        if (prog.resumePositionSeconds > 0 && prog.status !== 'completed') {
          resumeSeconds = prog.resumePositionSeconds;
        }
      } catch {
        // No progress yet — start from beginning
      }

      const res = await getSignedUrl(lectureId);
      if (res.type === 'bunny_embed') {
        const url = resumeSeconds > 0 ? `${res.url}&t=${resumeSeconds}` : res.url;
        setEmbedUrl(url);
        setUrlType('bunny');
        // Track expiry for auto-refresh
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
    } catch (err: any) {
      if (err.message?.includes('403') || err.message?.includes('Not enrolled')) {
        setError('You are not enrolled in this batch.');
      } else if (err.message?.includes('409')) {
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

  // Progress tracking for Bunny iframe via postMessage
  useEffect(() => {
    if (urlType !== 'bunny' || !embedUrl) return;

    let lastReportedTime = 0;

    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from Bunny's embed iframe
      if (event.origin !== 'https://iframe.mediadelivery.net') return;
      if (!event.data || typeof event.data !== 'object') return;
      const { event: evtType, currentTime, duration } = event.data;
      if (evtType === 'timeupdate' && duration > 0) {
        const pct = Math.round((currentTime / duration) * 100);
        const now = currentTime;
        lastKnownTimeRef.current = currentTime;
        // Report every 30 seconds or at end
        if (now - lastReportedTime >= 30 || pct >= 95) {
          lastReportedTime = now;
          updateProgress(lectureId, {
            watch_percentage: Math.min(pct, 100),
            resume_position_seconds: Math.round(currentTime),
          }).catch(() => {});
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [urlType, embedUrl, lectureId]);

  // Auto-refresh signed URL before expiry (5 minutes before)
  useEffect(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (urlType !== 'bunny' || !embedUrl || !expiresAtRef.current) return;

    const msUntilExpiry = expiresAtRef.current - Date.now();
    const refreshIn = msUntilExpiry - 5 * 60 * 1000; // 5 min before expiry
    if (refreshIn <= 0) return; // Already expired or too close

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const res = await getSignedUrl(lectureId);
        if (res.type === 'bunny_embed') {
          // Preserve playback position across URL refresh
          const resumeSec = Math.round(lastKnownTimeRef.current);
          const url = resumeSec > 0 ? `${res.url}&t=${resumeSec}` : res.url;
          setEmbedUrl(url);
          if (res.expiresAt) {
            expiresAtRef.current = new Date(res.expiresAt).getTime();
          }
        }
      } catch {
        setError('Video session expired. Please reload the page to continue watching.');
      }
    }, refreshIn);

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [urlType, embedUrl, lectureId]);

  // Processing state
  if (videoType === 'upload' && videoStatus && videoStatus !== 'ready') {
    if (videoStatus === 'failed') {
      return (
        <div className="aspect-video bg-gray-800 rounded-2xl flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle size={48} className="text-red-400 mx-auto mb-3" />
            <p className="text-white text-sm font-medium">Video processing failed</p>
            <p className="text-gray-400 text-xs mt-1">Please re-upload this video</p>
          </div>
        </div>
      );
    }
    return (
      <div className="aspect-video bg-gray-800 rounded-2xl flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={48} className="text-accent mx-auto mb-3 animate-spin" />
          <p className="text-white text-sm font-medium">Video is being processed...</p>
          <p className="text-gray-400 text-xs mt-1">This may take a few minutes</p>
        </div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="aspect-video bg-gray-800 rounded-2xl flex items-center justify-center">
        <Loader2 size={48} className="text-accent animate-spin" />
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="aspect-video bg-gray-800 rounded-2xl flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle size={48} className="text-yellow-400 mx-auto mb-3" />
          <p className="text-white text-sm font-medium">{error}</p>
          <button
            onClick={fetchSignedUrl}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white text-sm rounded-lg hover:bg-white/20 transition-colors"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // External link (non-embeddable)
  if (urlType === 'link' && embedUrl) {
    return (
      <div className="aspect-video bg-gray-800 rounded-2xl flex items-center justify-center">
        <div className="text-center">
          <PlayCircle size={64} className="text-accent mx-auto mb-3" />
          <a
            href={embedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-primary text-sm font-medium rounded-xl hover:bg-accent/80 transition-colors"
          >
            Open Video in New Tab
          </a>
        </div>
      </div>
    );
  }

  // Iframe player (Bunny, YouTube, Vimeo)
  if (embedUrl) {
    return (
      <div
        className="relative aspect-video bg-black rounded-2xl overflow-hidden"
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' } as React.CSSProperties}
      >
        {watermark && <WatermarkOverlay text={watermark} />}
        <iframe
          ref={iframeRef}
          src={embedUrl}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  }

  // Placeholder — no video
  return (
    <div className="aspect-video bg-gray-800 rounded-2xl flex items-center justify-center">
      <div className="text-center">
        <PlayCircle size={64} className="text-accent mx-auto mb-3" />
        <p className="text-white text-sm">Select a video to play</p>
      </div>
    </div>
  );
}

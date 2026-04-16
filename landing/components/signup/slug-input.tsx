'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { checkSlug } from '@/lib/api/public';

interface SlugInputProps {
  value: string;
  onChange: (slug: string) => void;
  onAvailabilityChange: (available: boolean) => void;
}

interface SlugResult {
  available: boolean;
  reason: string;
  isNetworkError?: boolean;
}

export function SlugInput({ value, onChange, onAvailabilityChange }: SlugInputProps) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<SlugResult | null>(null);
  // Abort in-flight requests when a new check starts to prevent stale results.
  const abortRef = useRef<AbortController | null>(null);

  const doCheck = useCallback(async (slug: string) => {
    if (slug.length < 3) {
      setResult(null);
      onAvailabilityChange(false);
      return;
    }

    // Cancel any previous in-flight check
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setChecking(true);
    try {
      const res = await checkSlug(slug, controller.signal);
      setResult({ available: res.available, reason: res.reason });
      onAvailabilityChange(res.available);
    } catch (err) {
      // Silently ignore aborted requests — a newer check is already running.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setResult({
        available: false,
        reason: 'Could not check availability — please check your connection.',
        isNetworkError: true,
      });
      onAvailabilityChange(false);
    } finally {
      // Only clear checking if this controller wasn't superseded
      if (!controller.signal.aborted) {
        setChecking(false);
      }
    }
  }, [onAvailabilityChange]);

  useEffect(() => {
    if (!value || value.length < 3) {
      setResult(null);
      onAvailabilityChange(false);
      return;
    }
    const timer = setTimeout(() => doCheck(value), 500);
    return () => clearTimeout(timer);
  }, [value, doCheck, onAvailabilityChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/--+/g, '-');
    onChange(raw);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-zen-dark mb-1.5">
        Subdomain (URL)
      </label>
      <div className="flex items-center gap-0">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder="your-institute"
          maxLength={30}
          className="flex-1 px-4 py-3 rounded-l-xl border border-r-0 border-gray-200 text-sm focus:outline-none focus:border-zen-purple transition-colors bg-gray-50"
        />
        <span className="px-3 py-3 bg-gray-100 border border-l-0 border-gray-200 rounded-r-xl text-sm text-gray-500 whitespace-nowrap">
          .zensbot.online
        </span>
      </div>
      {value.length >= 3 && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs">
          {checking ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
              <span className="text-gray-400">Checking...</span>
            </>
          ) : result ? (
            result.available ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                <span className="text-green-600">{result.reason}</span>
              </>
            ) : result.isNetworkError ? (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-amber-600">{result.reason}</span>
              </>
            ) : (
              <>
                <XCircle className="w-3.5 h-3.5 text-red-500" />
                <span className="text-red-600">{result.reason}</span>
              </>
            )
          ) : null}
        </div>
      )}
    </div>
  );
}

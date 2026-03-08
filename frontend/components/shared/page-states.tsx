'use client';

import { AlertCircle, RefreshCw, Inbox } from 'lucide-react';
import { ReactNode } from 'react';

/* ─── PageLoading ────────────────────────────────────────────────── */

interface PageLoadingProps {
  variant?: 'table' | 'cards' | 'detail';
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-xl ${className || ''}`} />;
}

export function PageLoading({ variant = 'table' }: PageLoadingProps) {
  if (variant === 'cards') {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div className="space-y-6">
        <SkeletonBlock className="h-24" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <SkeletonBlock className="h-64" />
            <SkeletonBlock className="h-48" />
          </div>
          <div className="space-y-6">
            <SkeletonBlock className="h-48" />
            <SkeletonBlock className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  // table variant (default)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-24" />
        ))}
      </div>
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="p-6 space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-12" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── PageError ──────────────────────────────────────────────────── */

interface PageErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function PageError({ message = 'Something went wrong', onRetry }: PageErrorProps) {
  return (
    <div className="bg-white rounded-2xl p-12 card-shadow text-center">
      <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <AlertCircle size={28} className="text-red-500" />
      </div>
      <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">Error</h3>
      <p className="text-sm text-gray-500 mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors"
        >
          <RefreshCw size={16} />
          Try Again
        </button>
      )}
    </div>
  );
}

/* ─── EmptyState ─────────────────────────────────────────────────── */

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="bg-white rounded-2xl p-12 card-shadow text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
        {icon || <Inbox size={28} className="text-gray-400" />}
      </div>
      <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">{title}</h3>
      {description && <p className="text-sm text-gray-500 mb-4">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

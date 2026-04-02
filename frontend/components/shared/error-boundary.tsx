'use client';

import React from 'react';
import { reportError } from '@/lib/utils/error-reporter';
import { AlertCircle, RefreshCw, MessageSquarePlus } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportError(error.message, {
      stack: error.stack,
      component: info.componentStack || undefined,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReportIssue = () => {
    window.dispatchEvent(new CustomEvent('open-feedback', {
      detail: {
        message: this.state.error?.message,
        stack: this.state.error?.stack,
      },
    }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={28} className="text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-primary mb-2">Something went wrong</h3>
            <p className="text-sm text-gray-500 mb-1">
              An unexpected error occurred. This has been automatically reported.
            </p>
            {this.state.error && (
              <p className="text-xs text-gray-400 mb-4 font-mono break-all">
                {this.state.error.message}
              </p>
            )}
            <div className="flex items-center gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors"
              >
                <RefreshCw size={16} />
                Try Again
              </button>
              <button
                onClick={this.handleReportIssue}
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <MessageSquarePlus size={16} />
                Report Issue
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

'use client';

import { Component, ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

// Minimal React error boundary scoped to the SA surface.
//
// Why: previously a render error in one SA chart / data hook (e.g.
// a tier value the frontend type didn't know about, a NaN in a
// donut) would unmount the entire /sa route and white-screen. With
// this boundary wrapping <main> in sa/layout.tsx, one component
// failing only shows a recoverable card — sidebar + other pages
// still work.

interface State {
  hasError: boolean;
  error?: Error;
}

interface Props {
  children: ReactNode;
}

export class SAErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Surface in console for dev + any global error reporter. We keep
    // this minimal — backend Sentry catches server errors; a frontend
    // Sentry client would also hook here once wired.
    // eslint-disable-next-line no-console
    console.error('[SA] render error', error, info);
  }

  reset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="p-6 max-w-xl mx-auto mt-12">
        <div className="bg-white rounded-2xl border border-red-200 p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-50 rounded-xl">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-zinc-900">
                Something broke on this page
              </h2>
              <p className="text-sm text-zinc-500 mt-1">
                The rest of the SA panel is fine — this section hit an unexpected error.
                You can retry below, or navigate to another section.
              </p>
              {this.state.error?.message && (
                <pre className="mt-3 p-2 bg-zinc-50 text-xs text-zinc-600 rounded-lg overflow-x-auto">
                  {this.state.error.message}
                </pre>
              )}
              <button
                onClick={this.reset}
                className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-sm hover:bg-zinc-800"
              >
                <RotateCw size={14} />
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

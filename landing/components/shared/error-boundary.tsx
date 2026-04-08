'use client';

import { Component, ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';

/**
 * React error boundary that catches rendering errors in its children and
 * renders a fallback UI instead. Logs the error to Sentry with extra context.
 *
 * Used to wrap the OnboardingAnimation so that if anything in the animation
 * crashes (Framer Motion bug, weird browser, broken prop), the user falls
 * back to the original spinner instead of seeing a white screen during
 * the most critical moment of the signup funnel.
 */
interface Props {
  children: ReactNode;
  fallback: ReactNode;
  context?: string;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string }) {
    // Send to Sentry with the context tag so we can filter for animation crashes
    Sentry.withScope((scope) => {
      scope.setTag('boundary', this.props.context || 'unknown');
      scope.setContext('react', {
        componentStack: errorInfo.componentStack,
      });
      Sentry.captureException(error);
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

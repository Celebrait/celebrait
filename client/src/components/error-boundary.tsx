// client/src/components/error-boundary.tsx
//
// React error boundary. There was NONE anywhere in the app (audit
// 2026-07-02), so any render-time throw — most likely a WebGL/texture
// failure in the three.js Card3DViewer at the reveal (the emotional peak
// of the product) — unmounted the whole React root and white-screened
// the entire app.
//
// Two uses:
//   • App-level (no `fallback`) → a friendly full-screen reload prompt.
//   • Around a Card3DViewer (`fallback={<img …>}`) → the card degrades to
//     a flat image instead of taking the page down.

import { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  isStaleChunkError,
  recoverFromStaleChunk,
  staleChunkRecoveryAvailable,
} from '@/lib/stale-chunk';

interface Props {
  children: ReactNode;
  /** Custom fallback UI. If omitted, a full-screen reload prompt. */
  fallback?: ReactNode;
  /** Label for the console log, to locate which boundary caught it. */
  label?: string;
}

interface State {
  hasError: boolean;
  /** A reload is already on its way — hold a quiet screen, not a crash. */
  recovering: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, recovering: false };

  // Renders BEFORE componentDidCatch, so a stale chunk used to flash the
  // full "Something went wrong" screen for the moment between the throw
  // and the reload it triggers (Aidan hit this signing in as a new user
  // on a heavy deploy day: "a quick screen"). Decide here whether a
  // reload is coming and, if so, show nothing alarming.
  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      recovering: isStaleChunkError(error) && staleChunkRecoveryAvailable(),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // A failed chunk import isn't a bug in the page — it's a browser
    // holding a bundle we've since replaced (deploy race). Reload once
    // rather than showing a crash screen for something a refresh fixes.
    if (isStaleChunkError(error)) {
      if (recoverFromStaleChunk(this.props.label ?? 'error-boundary')) return;
      // Recovery already spent this session — drop the quiet screen and
      // show the real thing rather than sitting on a blank page forever.
      this.setState({ recovering: false });
    }
    console.error(
      `[ErrorBoundary${this.props.label ? ` ${this.props.label}` : ''}]`,
      error,
      info.componentStack,
    );
    // Report home (2026-07-31). Customers were seeing this screen on
    // prod and we had no trace — the stack died in their console.
    // Fire-and-forget, and guarded so the REPORTER can never become a
    // second crash.
    try {
      void fetch('/api/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: this.props.label ?? 'app',
          path: window.location.pathname,
          message: error?.message ?? String(error),
          stack: error?.stack ?? '',
          componentStack: info.componentStack ?? '',
        }),
        // Let the report survive an imminent reload tap.
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* never throw from the boundary */
    }
  }

  render() {
    if (this.state.hasError) {
      // Mid-recovery: the browser is reloading. Match the app background so
      // it reads as a page still loading, which is what it is.
      if (this.state.recovering && this.props.fallback === undefined) {
        return (
          <div
            className="min-h-screen bg-surface-card"
            aria-busy="true"
            aria-live="polite"
            data-testid="boundary-recovering"
          />
        );
      }
      if (this.props.fallback !== undefined) return this.props.fallback;
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center bg-surface-card">
          <p className="text-lg font-semibold text-ink">Something went wrong</p>
          <p className="text-sm text-stone-600 max-w-sm leading-relaxed">
            A hiccup on our end — your work is saved. Reloading usually sorts it.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground hover:bg-brand-dark transition-colors"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

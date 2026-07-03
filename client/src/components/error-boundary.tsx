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

interface Props {
  children: ReactNode;
  /** Custom fallback UI. If omitted, a full-screen reload prompt. */
  fallback?: ReactNode;
  /** Label for the console log, to locate which boundary caught it. */
  label?: string;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[ErrorBoundary${this.props.label ? ` ${this.props.label}` : ''}]`,
      error,
      info.componentStack,
    );
  }

  render() {
    if (this.state.hasError) {
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

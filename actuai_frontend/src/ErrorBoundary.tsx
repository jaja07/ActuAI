import React from 'react';

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Last line of defense: any uncaught render/commit error shows a recoverable
 * panel instead of unmounting the whole app into a white page.
 */
export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Uncaught UI error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="h-screen flex items-center justify-center bg-surface text-on-surface p-6">
        <div className="max-w-md w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-8 shadow-2xl text-center space-y-4">
          <h1 className="text-title-md font-bold">Something went wrong</h1>
          <p className="text-body-md text-on-surface-variant">
            The dashboard hit an unexpected error. Your data is safe — reloading
            the page will restore the session.
          </p>
          <p className="text-xs font-mono text-on-surface-variant/70 break-all">
            {this.state.error.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-on-primary rounded font-bold hover:opacity-90 cursor-pointer"
          >
            Reload dashboard
          </button>
        </div>
      </div>
    );
  }
}

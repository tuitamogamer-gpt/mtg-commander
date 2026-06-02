import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Catches render errors anywhere in the tree and shows a friendly fallback
 * instead of a blank screen. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Hook for error tracking (e.g. Sentry.captureException) in the future.
    console.error("UI error boundary caught:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-4xl">🛠️</div>
        <h1 className="text-xl font-bold text-white">Something went wrong</h1>
        <p className="max-w-md text-sm text-muted">
          The interface hit an unexpected error. Reloading usually fixes it. If it keeps happening,
          copy the details below and report it.
        </p>
        <pre className="max-w-lg overflow-auto rounded bg-surface-2 p-3 text-left text-xs text-danger">
          {this.state.error.message}
        </pre>
        <div className="flex gap-2">
          <button
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-black"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
          <button
            className="rounded-md border border-border px-4 py-2 text-sm text-white"
            onClick={() => {
              void navigator.clipboard?.writeText(
                `${this.state.error?.message}\n\n${this.state.error?.stack ?? ""}`
              );
            }}
          >
            Copy error
          </button>
        </div>
      </div>
    );
  }
}

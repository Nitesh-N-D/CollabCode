import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: string }
> {
  state = { error: "" };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : "Something unexpected happened." };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[dashboard]", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="app-error">
        <AlertTriangle size={28} />
        <h1>We hit a recoverable UI error.</h1>
        <p>{this.state.error}</p>
        <button className="button primary" onClick={() => window.location.reload()} type="button">
          <RefreshCcw size={16} /> Reload dashboard
        </button>
      </div>
    );
  }
}

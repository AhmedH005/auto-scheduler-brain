import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[axis] render error', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 z-[100] bg-background overflow-auto p-8 font-mono text-sm">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-xl text-destructive font-bold mb-3">
              axis crashed at render time
            </h1>
            <p className="text-muted-foreground mb-4">
              {this.state.error.name}: {this.state.error.message}
            </p>
            <pre className="text-[11px] bg-card/40 border border-border rounded-lg p-4 whitespace-pre-wrap overflow-auto leading-relaxed">
              {this.state.error.stack}
            </pre>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-4 px-4 h-9 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold"
            >
              try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

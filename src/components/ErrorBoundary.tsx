import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Top-level error boundary that catches unhandled React errors and
 * displays a recovery UI instead of crashing to a white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100vh',
                    fontFamily: 'system-ui, sans-serif',
                    color: 'var(--color-text-primary)',
                    backgroundColor: 'var(--color-bg-primary)',
                    padding: '2rem',
                    textAlign: 'center',
                }}>
                    <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                        Something went wrong
                    </h1>
                    <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', maxWidth: '400px' }}>
                        {this.state.error?.message || 'An unexpected error occurred.'}
                    </p>
                    <button
                        onClick={this.handleReload}
                        style={{
                            padding: '0.5rem 1.5rem',
                            borderRadius: '6px',
                            border: '1px solid var(--color-border-light)',
                            backgroundColor: 'var(--color-panel-bg)',
                            color: 'var(--color-text-primary)',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                        }}
                    >
                        Reload Application
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

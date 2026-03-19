import { Component } from 'react';

/**
 * M-003: React Error Boundary
 * Catches runtime JS errors in the component tree and shows a fallback UI
 * instead of crashing the entire SPA.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log to console in dev; in production this could be sent to an APM service
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
    window.location.href = '/dashboard';
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Something went wrong
            </h1>
            <p className="text-gray-600 mb-6">
              An unexpected error occurred. Please try returning to the dashboard.
              If the problem persists, contact your administrator.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <details className="text-left mb-6 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 font-mono break-all">
                <summary className="cursor-pointer font-semibold mb-1">
                  Error details (dev only)
                </summary>
                {this.state.error.toString()}
              </details>
            )}
            <button
              onClick={() => this.handleReset()}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

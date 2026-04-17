import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { MainPage } from './pages/MainPage';

// ── 전역 에러 바운더리 ─────────────────────────────────────────────────────

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-4 text-center px-8 bg-gray-50">
          <AlertCircle size={48} className="text-red-400" />
          <div>
            <h1 className="text-lg font-bold text-gray-800 mb-1">예상치 못한 오류가 발생했습니다</h1>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              {this.state.error.message}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg
                       text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <RefreshCw size={14} />
            페이지 새로고침
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── 앱 진입점 ──────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ErrorBoundary>
      <MainPage />
    </ErrorBoundary>
  );
}

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in SEVA Portal:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F7FAF8] flex items-center justify-center p-6 text-center">
          <div className="max-w-md bg-white p-8 rounded-3xl shadow-lg border border-stone-200 space-y-5">
            <div className="w-16 h-16 bg-emerald-100 text-[#184E34] rounded-2xl flex items-center justify-center mx-auto text-2xl font-bold">
              🌱
            </div>
            <h1 className="text-2xl font-black text-[#143E29]">SEVA Portal</h1>
            <p className="text-sm text-stone-600">
              वेबसाइट लोड करताना तांत्रिक अडचण आली आहे. कृपया पृष्ठ पुन्हा रिफ्रेश करा.
            </p>
            {this.state.error && (
              <pre className="text-xs bg-stone-100 p-3 rounded-xl text-left overflow-auto text-stone-700 max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => {
                localStorage.clear();
                window.location.href = '/';
              }}
              className="w-full py-3 bg-[#184E34] hover:bg-[#0F3825] text-white font-bold rounded-full transition-all cursor-pointer"
            >
              Refresh Portal
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

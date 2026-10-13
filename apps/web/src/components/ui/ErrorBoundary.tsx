'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
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
    console.error('ErrorBoundary caught an unhandled rendering error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-card" role="alert">
          <h3>
            <AlertTriangle size={18} />
            {this.props.fallbackTitle || 'Component Error Occurred'}
          </h3>
          <p>
            {this.state.error?.message ||
              'A rendering issue interrupted this view. The rest of the dashboard remains operational.'}
          </p>
          <button
            type="button"
            className="button button-secondary"
            onClick={this.handleReset}
            style={{ fontSize: '11px', height: '32px' }}
          >
            <RefreshCw size={13} />
            <span>Retry Component</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

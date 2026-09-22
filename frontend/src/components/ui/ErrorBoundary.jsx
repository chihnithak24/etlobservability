import React from 'react';
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: 'var(--bg-main, #f8fafc)',
          color: 'var(--text-main, #1e293b)',
          fontFamily: 'Inter, system-ui, sans-serif'
        }}>
          <div className="card" style={{
            maxWidth: 480,
            width: '100%',
            padding: 32,
            textAlign: 'center',
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-color, #cbd5e1)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
          }}>
            <div style={{
              width: 54, height: 54, borderRadius: '50%',
              background: 'var(--error-bg, #ffe4e6)',
              border: '1px solid var(--error-border, #fecdd3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', color: 'var(--error, #dc2626)'
            }}>
              <AlertTriangle size={28} />
            </div>

            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Application Encountered an Issue</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary, #475569)', marginBottom: 20 }}>
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={this.handleReset}
                className="btn-primary"
                style={{ padding: '8px 16px', fontSize: 13, gap: 6 }}
              >
                <RefreshCw size={14} /> Reload App
              </button>
              <button
                onClick={this.handleLogout}
                className="btn-secondary"
                style={{ padding: '8px 14px', fontSize: 13, gap: 6 }}
              >
                <LogOut size={14} /> Clear Session & Login
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

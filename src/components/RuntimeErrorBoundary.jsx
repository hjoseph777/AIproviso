import { Component } from 'react';

export default class RuntimeErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[RuntimeErrorBoundary] Renderer error:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: 220,
            border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 10,
            background: 'rgba(8,18,30,.82)',
            display: 'grid',
            placeItems: 'center',
            padding: 20,
            color: '#dcecff',
            textAlign: 'center',
          }}
        >
          <div>
            <h3 style={{ margin: '0 0 8px' }}>Workflow surface recovered from an error</h3>
            <p style={{ margin: '0 0 12px', opacity: 0.85 }}>
              A runtime issue occurred in the designer panel. You can reload this pane without restarting Electron.
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              style={{
                border: '1px solid rgba(126,167,212,.4)',
                borderRadius: 999,
                background: 'rgba(20,36,58,.9)',
                color: '#dcecff',
                padding: '7px 14px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Retry panel
            </button>
            {this.state.error?.message ? (
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.72 }}>
                {this.state.error.message}
              </div>
            ) : null}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

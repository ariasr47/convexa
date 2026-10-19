/**
 * The last line of defence above the whole app: a throw that escapes every route and widget
 * boundary (or happens in a provider, above them all) shows this notice instead of a blank page.
 *
 * It sits OUTSIDE the router and the MUI theme provider, so it uses neither: plain elements, the
 * token palette for the theme already painted on <html data-theme>, and real links.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { palette, typographyTokens } from '../theme/tokens';

interface State {
  error: Error | null;
}

export class RootErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep console noise for operators; never ship PII.
    console.error('[RootErrorBoundary]', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    const light =
      typeof document !== 'undefined' &&
      document.documentElement.getAttribute('data-theme') === 'light';
    const p = light ? palette.light : palette.dark;
    const action = {
      font: 'inherit',
      fontWeight: 600,
      fontSize: 14,
      minHeight: 40,
      padding: '8px 16px',
      borderRadius: 8,
      cursor: 'pointer',
      textDecoration: 'none',
      display: 'inline-flex',
      alignItems: 'center',
    } as const;
    return (
      <div
        role="alert"
        data-testid="root-error-boundary"
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          boxSizing: 'border-box',
          background: p.background.default,
          color: p.text.primary,
          fontFamily: typographyTokens.fontFamily,
        }}
      >
        <div style={{ maxWidth: 440 }}>
          <h1 style={{ fontSize: 20, lineHeight: 1.3, margin: '0 0 8px' }}>
            Convexa couldn't finish loading
          </h1>
          <p style={{ margin: '0 0 20px', lineHeight: 1.5, color: p.text.secondary }}>
            Something broke before this page could draw. Reloading usually fixes it.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                ...action,
                border: 'none',
                background: p.primary.main,
                color: p.primary.contrastText,
              }}
            >
              Reload
            </button>
            <a
              href="/"
              style={{
                ...action,
                border: `1px solid ${p.text.secondary}`,
                color: p.text.primary,
              }}
            >
              Home page
            </a>
          </div>
        </div>
      </div>
    );
  }
}

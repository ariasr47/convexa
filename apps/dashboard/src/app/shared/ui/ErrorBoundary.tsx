/**
 * Route / widget error boundaries — honest degraded UI so one throw cannot blank the desk.
 * Class component required by React error-boundary API.
 */
import { Box, Button, Typography } from '@mui/material';
import { Component, type ErrorInfo, type ReactNode } from 'react';

export type ErrorBoundaryVariant = 'route' | 'widget';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** `route` = full page region; `widget` = single board tile. */
  variant?: ErrorBoundaryVariant;
  /** Optional label for the failed surface (e.g. widget id). */
  label?: string;
  /** Test id override. */
  testId?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep console noise for operators; never ship PII.
    console.error(
      '[ErrorBoundary]',
      this.props.label ?? this.props.variant,
      error,
      info.componentStack,
    );
  }

  private reset = () => {
    this.setState({ error: null });
  };

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const variant = this.props.variant ?? 'route';
    const isWidget = variant === 'widget';
    const title = isWidget
      ? `${this.props.label ?? 'This panel'} could not render`
      : 'This page could not load';
    const body = isWidget
      ? 'The rest of the desk stays available. Retry this panel or refresh the page.'
      : 'Something broke while rendering this view. You can retry or return to a public surface.';

    return (
      <Box
        role="alert"
        data-testid={
          this.props.testId ?? (isWidget ? 'widget-error-boundary' : 'route-error-boundary')
        }
        data-variant={variant}
        sx={{
          p: isWidget ? 2 : 4,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          maxWidth: isWidget ? '100%' : 480,
          mx: isWidget ? 0 : 'auto',
          my: isWidget ? 0 : 4,
        }}
      >
        <Typography
          component="h2"
          variant={isWidget ? 'subtitle2' : 'h6'}
          sx={{ m: 0, mb: 1, fontWeight: 700 }}
        >
          {title}
        </Typography>
        <Typography component="p" variant="body2" sx={{ m: 0, mb: 2, color: 'text.secondary' }}>
          {body}
        </Typography>
        <Button variant="outlined" size="small" onClick={this.reset} sx={{ minHeight: 40 }}>
          Retry
        </Button>
      </Box>
    );
  }
}

export default ErrorBoundary;

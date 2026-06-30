/**
 * "Continue with Google" — the first-class PRESENT-BUT-DISABLED-WHEN-UNCONFIGURED control (D9,
 * UX_BLUEPRINT §2.4). Driven by `google_available` from who-am-I (NOT a build flag), so config-only
 * enabling flips disabled↔enabled with NO rebuild (AC-G3).
 *
 *  - `available=false` (DEFAULT this phase, AC-G1): visibly present + disabled (greyed, not clickable,
 *    not hidden) + a quiet helper line. Absent creds cause NO crash (AC-G2).
 *  - `available=true` (AC-G3): enabled/clickable; starts the server-side flow by navigating to
 *    `/api/auth/google/start` (a full-page redirect — the server does the OAuth dance).
 */
import { Box, Button, Tooltip, Typography } from '@mui/material';
import { AUTH_COPY } from './copy';

/** The official multicolor Google "G" (the MUI GoogleIcon is monochrome). */
function GoogleG() {
  return (
    <Box component="svg" viewBox="0 0 48 48" sx={{ width: 18, height: 18, display: 'block' }} aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Box>
  );
}

export function GoogleButton({ available }: { available: boolean }) {
  const start = () => {
    // Full-page redirect into the server-side Google flow (only reachable when enabled).
    window.location.href = '/api/auth/google/start';
  };

  // White button with the multicolor G, per the Figma AuthModal. When unconfigured it stays present
  // but disabled (dimmed + not clickable + the helper note) — the honest config-gated affordance.
  const button = (
    <Button
      fullWidth
      variant="contained"
      disableElevation
      startIcon={<GoogleG />}
      disabled={!available}
      onClick={available ? start : undefined}
      data-testid="google-button"
      aria-disabled={!available}
      sx={{
        bgcolor: '#fff',
        color: '#1f1f1f',
        fontWeight: 600,
        textTransform: 'none',
        '&:hover': { bgcolor: '#f1f3f4' },
        '&.Mui-disabled': { bgcolor: '#fff', color: '#1f1f1f', opacity: 0.5 },
      }}
    >
      {AUTH_COPY.google.label}
    </Button>
  );

  return (
    <Box>
      {available ? (
        button
      ) : (
        // A disabled MUI button suppresses pointer events, so wrap in a span for the tooltip to fire.
        <Tooltip arrow title={AUTH_COPY.google.tooltipDisabled}>
          <span>{button}</span>
        </Tooltip>
      )}
      {!available && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 0.5 }}
          data-testid="google-helper"
        >
          {AUTH_COPY.google.helperDisabled}
        </Typography>
      )}
    </Box>
  );
}

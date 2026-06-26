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
import GoogleIcon from '@mui/icons-material/Google';
import { AUTH_COPY } from './copy';

export function GoogleButton({ available }: { available: boolean }) {
  const start = () => {
    // Full-page redirect into the server-side Google flow (only reachable when enabled).
    window.location.href = '/api/auth/google/start';
  };

  const button = (
    <Button
      fullWidth
      variant="outlined"
      color="inherit"
      startIcon={<GoogleIcon />}
      disabled={!available}
      onClick={available ? start : undefined}
      data-testid="google-button"
      aria-disabled={!available}
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

/**
 * RequireAuth — the route-level sign-in wall for the private surfaces (owner lockdown, 2026-08-06).
 *
 * Wraps `/scanner` and `/positions`. Landing, `/ticker/*`, `/blog` and `/settings` stay PUBLIC by
 * owner decision — this is a narrowing of the `user-accounts` hybrid-access model, not a full
 * lock-out.
 *
 * This is a UX affordance ONLY. The real enforcement is server-side: `/api/scan*` and the
 * positions write gate refuse a signed-out caller with 403 `auth_required` regardless of what the
 * browser does ([server-side-gate-enforcement]).
 *
 * Product spine: refuse VISIBLY (never silent redirect), say what unlocks, and leave a free path
 * into the public Ticker so the funnel does not dead-end.
 */
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useAuthDialog } from './AuthDialogProvider';
import { AUTH_COPY } from './copy';

interface Props {
  children: ReactNode;
  /** What the user was trying to reach, for the copy — e.g. "the scanner". */
  surface: string;
}

/** Spine-aware unlock copy keyed by the `surface` prop passed from the route table. */
function wallCopy(surface: string): { unlocks: string; freePath: string } {
  if (surface.includes('scanner')) {
    return {
      unlocks:
        'See ranked dealer-gamma setups across the universe, then jump into any name for walls, flip, and flow.',
      freePath: 'Ticker analysis stays free — open any symbol without an account.',
    };
  }
  if (surface.includes('position')) {
    return {
      unlocks:
        'Track simulated positions, saved views, and P/L so you can practice the plan after you read the structure.',
      freePath: 'Ticker analysis stays free — open any symbol without an account.',
    };
  }
  return {
    unlocks: 'This area is limited to invited accounts while Convexa is in private testing.',
    freePath: 'Ticker analysis stays free without an account.',
  };
}

export function RequireAuth({ children, surface }: Props) {
  const { ready, authenticated } = useAuth();
  const { openAuth } = useAuthDialog();
  const copy = wallCopy(surface);

  // Hold the wall back until who-am-I resolves, or a signed-in user sees a sign-in prompt flash
  // on every hard load of these routes.
  if (!ready) return null;
  if (authenticated) return <>{children}</>;

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: { xs: 6, md: 10 }, px: 2 }}>
      <Paper
        variant="outlined"
        data-testid="require-auth-wall"
        sx={{ maxWidth: 520, width: '100%', p: { xs: 3, md: 4 }, textAlign: 'center' }}
      >
        <Stack spacing={2} sx={{ alignItems: 'center' }}>
          <Typography variant="h6" component="h1">
            Sign in to open {surface}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {copy.unlocks}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {copy.freePath}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 400 }}>
            Private testing — invited accounts only. Landing, ticker, and blog stay open without
            signing in.
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ mt: 1, width: '100%', justifyContent: 'center' }}
          >
            <Button
              variant="contained"
              onClick={() => openAuth()}
              data-testid="require-auth-signin"
            >
              {AUTH_COPY.account.signIn}
            </Button>
            <Button
              component={RouterLink}
              to="/ticker"
              variant="outlined"
              data-testid="require-auth-ticker"
            >
              Open free Ticker →
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}

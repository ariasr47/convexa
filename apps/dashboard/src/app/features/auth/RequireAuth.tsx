/**
 * RequireAuth — the route-level sign-in wall for the private surfaces (owner lockdown, 2026-08-06).
 *
 * Wraps `/scanner` and `/positions`. Landing, `/ticker/*`, `/blog` and `/settings` stay PUBLIC by
 * owner decision — this is a narrowing of the `user-accounts` hybrid-access model, not a full
 * lock-out.
 *
 * This is a UX affordance ONLY. The real enforcement is server-side: `/api/scan*` and the
 * positions write gate refuse a signed-out caller with 403 `auth_required` regardless of what the
 * browser does ([server-side-gate-enforcement] — a bypassed or absent client check must still be
 * rejected at the server). Deleting this file would make the app rude, not insecure.
 *
 * It refuses VISIBLY rather than redirecting: a silent bounce to `/` leaves the user with no idea
 * why, which is the same "looks usable, then declines" failure the refused-affordance work exists
 * to prevent.
 */
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useAuthDialog } from './AuthDialogProvider';

interface Props {
  children: ReactNode;
  /** What the user was trying to reach, for the copy — e.g. "the scanner". */
  surface: string;
}

export function RequireAuth({ children, surface }: Props) {
  const { ready, authenticated } = useAuth();
  const { openAuth } = useAuthDialog();

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
            {/* Deliberately does NOT conjugate around `surface` — "your positions IS limited" is
                the bug that wording produces. The second sentence carries the surface instead. */}
            Convexa is in private testing, so this area is limited to invited accounts. The ticker
            view stays open — you can keep using it without an account.
          </Typography>
          <Button variant="contained" onClick={() => openAuth()} data-testid="require-auth-signin">
            Sign in
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

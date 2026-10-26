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
 * into the public Ticker so the funnel does not dead-end. Sign-ups are closed: the wall says so and
 * links the same screen on the demo (owner ruling 2026-10-14 (1)).
 */
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { STAGING_DEMO_URL } from '@/shared/lib/demoSite';
import { typographyTokens } from '@/shared/theme/tokens';
import { RouteFallback } from '@/shared/ui/RouteFallback';
import { dataMode } from '@convexa/api';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useAuthDialog } from './AuthDialogProvider';
import { AUTH_COPY } from './copy';

interface Props {
  children: ReactNode;
  /** What the user was trying to reach, for the copy — e.g. "the scanner". */
  surface: string;
  /** The same screen on the staging demo, e.g. "/scanner". Sign-ups are closed, so a visitor who
   *  can't sign in still gets to see it working (owner ruling 2026-10-14). */
  demoPath?: string;
  /** The route's tab title, e.g. "Scanner — Convexa": set here, before the demo's early
   *  return, so the wall and the page behind it share it (spec 2026-10-21/02, part (e)). */
  docTitle?: string;
}

/** Spine-aware unlock copy keyed by the `surface` prop passed from the route table
 *  (design/src/screens/final/account-pages.mjs scannerWall / positionsWall). */
function wallCopy(surface: string): { unlocks: string; demo: string } {
  if (surface.includes('scanner')) {
    return {
      unlocks:
        'See ranked dealer-gamma setups across the universe, then jump into any name for walls, flip and flow.',
      demo: 'Want to see a scan? The demo account runs one, on sample data.',
    };
  }
  if (surface.includes('position')) {
    return {
      unlocks:
        'Track simulated positions, saved views and P&L so you can practise the plan after you read the structure. Positions are paper only.',
      demo: 'Want to see a book? The demo account has one, on sample data.',
    };
  }
  return {
    unlocks: 'This area is limited to invited accounts while Convexa is in private testing.',
    demo: 'The demo account shows this screen on sample data.',
  };
}

/** Sign-ups are closed (owner ruling 2026-10-14): the wall says so, and what stays open. */
export const WALL_POLICY =
  'Invited accounts only; new sign-ups are closed while Convexa is in private testing. Research, rates, positioning and short data are open to everyone.';

export function RequireAuth({ children, surface, demoPath, docTitle }: Props) {
  // Before the demo's early return: the wall and the page behind it share one title.
  useDocumentTitle(docTitle ?? null);
  const { ready, authenticated, subsystemDegraded, refresh } = useAuth();
  const { openAuth } = useAuthDialog();
  const signInRef = useRef<HTMLButtonElement>(null);
  const copy = wallCopy(surface);

  // The public sample workspace owns a local paper book and does not use server authorization.
  if (dataMode === 'demo') return <>{children}</>;

  // The who-am-I read is in flight → the shared QUIET FILL. Never the wall, never `null`, never a
  // wall skeleton or a greyed `Sign in`. `null` is not a hold a person can perceive; the fallback's
  // only string is aria-label="Loading page", which asserts nothing about the session. This is the
  // codebase's own answer: `DefaultTickerRedirect` renders it on the identical fact.
  if (!ready) return <RouteFallback />;
  if (authenticated) return <>{children}</>;

  // Neutral outlined secondaries from the theme (owner ruling A, 2026-10-15): "Sign in" is the
  // wall's one amber action.
  const outlinedSx = { minHeight: 44 };
  return (
    <Box sx={{ py: { xs: 3, md: 7 }, px: 2 }}>
      <Paper
        variant="outlined"
        component="section"
        aria-label={
          subsystemDegraded ? AUTH_COPY.gate.sessionUnknown : `Sign in to open ${surface}`
        }
        data-testid="require-auth-wall"
        sx={{
          maxWidth: 600,
          mx: 'auto',
          p: { xs: '22px', md: 4 },
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '14px',
        }}
      >
        <DataStateTag state="signIn" label="Private testing" />
        {/* The board's wall title (`.ac-wall h1`, a `.display` face): Archivo 28px at line height
            1.1 at every width, phone included (fidelity audit 2026-10-25, ACC-16). */}
        <Typography
          component="h1"
          sx={{
            m: 0,
            fontFamily: typographyTokens.displayFontFamily,
            fontStretch: typographyTokens.displayFontStretch,
            fontSize: 28,
            lineHeight: 1.1,
            fontWeight: 700,
            letterSpacing: '-0.01em',
          }}
        >
          {subsystemDegraded ? AUTH_COPY.gate.sessionUnknown : `Sign in to open ${surface}`}
        </Typography>
        {subsystemDegraded && (
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            {AUTH_COPY.gate.unavailable}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          {copy.unlocks}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '10px', width: '100%' }}>
          <Button
            variant="contained"
            ref={signInRef}
            onClick={() => openAuth({ returnFocus: signInRef.current })}
            data-testid="require-auth-signin"
            sx={{ minHeight: 44, flex: { xs: '1 1 100%', sm: '0 0 auto' } }}
          >
            {AUTH_COPY.account.signIn}
          </Button>
          {subsystemDegraded && (
            <Button
              variant="outlined"
              onClick={() => void refresh()}
              data-testid="require-auth-retry"
              sx={{ ...outlinedSx, flex: { xs: '1 1 100%', sm: '0 0 auto' } }}
            >
              {AUTH_COPY.gate.retry}
            </Button>
          )}
          {/* The demo is the wall's real next step for every visitor but the owner, so it comes
              second: a neutral outlined 44px button, not a 24px inline link at the foot (spec
              2026-10-21/02, part (b); 126x24 at 390 before). After Try again when that shows. */}
          {demoPath && (
            <Button
              href={`${STAGING_DEMO_URL}${demoPath}`}
              variant="outlined"
              data-testid="require-auth-demo-link"
              sx={{ ...outlinedSx, flex: { xs: '1 1 100%', sm: '0 0 auto' } }}
            >
              See it on the demo →
            </Button>
          )}
          <Button
            component={RouterLink}
            to="/ticker"
            variant="outlined"
            data-testid="require-auth-ticker"
            sx={{ ...outlinedSx, flex: { xs: '1 1 100%', sm: '0 0 auto' } }}
          >
            Open a ticker desk
          </Button>
        </Box>
        <Typography
          variant="body2"
          color="text.secondary"
          data-testid="require-auth-policy"
          sx={{ fontSize: 13, lineHeight: 1.6 }}
        >
          {WALL_POLICY}
        </Typography>
        {demoPath && (
          <Typography
            variant="body2"
            color="text.secondary"
            data-testid="require-auth-demo"
            sx={{
              fontSize: 13,
              lineHeight: 1.6,
              pt: 1.5,
              borderTop: 1,
              borderColor: 'divider',
              width: '100%',
            }}
          >
            {copy.demo}
          </Typography>
        )}
      </Paper>
    </Box>
  );
}

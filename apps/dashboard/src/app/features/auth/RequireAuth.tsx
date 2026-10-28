/**
 * RequireAuth — the route-level sign-in wall for the private surfaces (owner lockdown, 2026-08-06),
 * and the owner gate's wall behind it.
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
 *
 * The owner gate (docs/product/ai-analyst/DESIGN.md, 2026-10-26): signed in is not the owner. Every
 * route that serves values computed from the licensed options feed answers anyone but the owner
 * with 403 `owner_only`, and everyone while the API's `OWNER_EMAILS` is unset. `OwnerGateBoundary`
 * puts that answer on the page: once an owner-only read meets a refusal (`ownerGate.ts`), the page
 * gives way to a wall, which unmounts its pollers and streams until the session changes. It sits
 * inside RequireAuth for the scanner and positions, and around the full ticker desk (app.tsx).
 */
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { MONO_FACE } from '@/shared/figure/figureFace';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { STAGING_DEMO_URL } from '@/shared/lib/demoSite';
import { typographyTokens } from '@/shared/theme/tokens';
import { RouteFallback } from '@/shared/ui/RouteFallback';
import { coarseFloor } from '@/shared/ui/touch';
import { dataMode } from '@convexa/api';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useAuthDialog } from './AuthDialogProvider';
import { AUTH_COPY } from './copy';
import { useOwnerGate } from './ownerGate';

interface WallProps {
  /** What the user was trying to reach, for the copy — e.g. "the scanner". */
  surface: string;
  /** The same screen on the staging demo, e.g. "/scanner". Sign-ups are closed, so a visitor who
   *  can't sign in still gets to see it working (owner ruling 2026-10-14). */
  demoPath?: string;
  /** The wall's free path into the public site; "Open a ticker desk" unless the wall stands on a
   *  desk, where that would lead back to itself. */
  freePath?: { to: string; label: string };
}

interface Props extends WallProps {
  children: ReactNode;
  /** The route's tab title, e.g. "Scanner — Convexa": set here, before the demo's early
   *  return, so the wall and the page behind it share it (spec 2026-10-21/02, part (e)). */
  docTitle?: string;
}

interface WallCopy {
  unlocks: string;
  demo: string;
  /** The owner gate's sentence, and the short name its wall's region takes. */
  owner: string;
  ownerLabel: string;
}

const DEFAULT_COPY: WallCopy = {
  unlocks: 'This area is limited to invited accounts while Convexa is in private testing.',
  demo: 'The demo account shows this screen on sample data.',
  owner: 'This page is private to the account that owns this Convexa.',
  ownerLabel: 'Private page',
};

/** Spine-aware unlock copy keyed by the `surface` prop passed from the route table
 *  (design/src/screens/final/account-pages.mjs scannerWall / positionsWall). `owner` is the owner
 *  gate's sentence: spec 08's "Not the owner" ("This journal is private to the account that owns
 *  this Convexa."), adapted from the journal to each surface of the tool. */
function wallCopy(surface: string): WallCopy {
  if (surface.includes('scanner')) {
    return {
      unlocks:
        'See ranked dealer-gamma setups across the universe, then jump into any name for walls, flip and flow.',
      demo: 'Want to see a scan? The demo account runs one, on sample data.',
      owner: 'The scanner is private to the account that owns this Convexa.',
      ownerLabel: 'Private scanner',
    };
  }
  if (surface.includes('position')) {
    return {
      unlocks:
        'Track simulated positions, saved views and P&L so you can practise the plan after you read the structure. Positions are paper only.',
      demo: 'Want to see a book? The demo account has one, on sample data.',
      owner: 'Positions are private to the account that owns this Convexa.',
      ownerLabel: 'Private positions',
    };
  }
  if (surface.includes('desk')) {
    return {
      ...DEFAULT_COPY,
      owner: 'This desk is private to the account that owns this Convexa.',
      ownerLabel: 'Private desk',
    };
  }
  return DEFAULT_COPY;
}

/** Sign-ups are closed (owner ruling 2026-10-14): the wall says so, and what stays open. */
export const WALL_POLICY =
  'Invited accounts only; new sign-ups are closed while Convexa is in private testing. Research, rates, positioning and short data are open to everyone.';

/** The wall's outer spacing and its panel: one 600px outlined panel, its items 14px apart. */
const wallOuterSx = { py: { xs: 3, md: 7 }, px: 2 } as const;
const wallPanelSx = {
  maxWidth: 600,
  mx: 'auto',
  p: { xs: '22px', md: 4 },
  borderRadius: '16px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '14px',
} as const;
/** The board's wall title (`.ac-wall h1`, a `.display` face): Archivo 28px at line height 1.1 at
 *  every width, phone included (fidelity audit 2026-10-25, ACC-16). */
const wallTitleSx = {
  m: 0,
  fontFamily: typographyTokens.displayFontFamily,
  fontStretch: typographyTokens.displayFontStretch,
  fontSize: 28,
  lineHeight: 1.1,
  fontWeight: 700,
  letterSpacing: '-0.01em',
} as const;
const wallButtonsSx = { display: 'flex', flexWrap: 'wrap', gap: '10px', width: '100%' } as const;
/** One wall button: full width on a phone, its own width from 600px. */
const wallButtonFlex = { flex: { xs: '1 1 100%', sm: '0 0 auto' } } as const;
/** A caption at the wall's foot, under a rule. */
const wallFootSx = {
  fontSize: 13,
  lineHeight: 1.6,
  pt: 1.5,
  borderTop: 1,
  borderColor: 'divider',
  width: '100%',
} as const;

export function RequireAuth({ children, surface, demoPath, docTitle }: Props) {
  // Before the demo's early return: the wall and the page behind it share one title.
  useDocumentTitle(docTitle ?? null);
  const { ready, authenticated } = useAuth();

  // The public sample workspace owns a local paper book and does not use server authorization.
  if (dataMode === 'demo') return <>{children}</>;

  // The who-am-I read is in flight → the shared QUIET FILL. Never the wall, never `null`, never a
  // wall skeleton or a greyed `Sign in`. `null` is not a hold a person can perceive; the fallback's
  // only string is aria-label="Loading page", which asserts nothing about the session. This is the
  // codebase's own answer: `DefaultTickerRedirect` renders it on the identical fact.
  if (!ready) return <RouteFallback />;
  if (!authenticated) return <SignInWall surface={surface} demoPath={demoPath} />;
  return (
    <OwnerGateBoundary surface={surface} demoPath={demoPath}>
      {children}
    </OwnerGateBoundary>
  );
}

/**
 * The owner gate on the page: `children` until an owner-only read meets a refusal for this session,
 * then the wall that says which (`ownerGate.ts`). The wall replaces the surface, so its pollers and
 * streams unmount; a sign-in or sign-out clears the refusal and mounts it again.
 */
export function OwnerGateBoundary({ children, ...wall }: WallProps & { children: ReactNode }) {
  const refusal = useOwnerGate();
  const { authenticated, refresh } = useAuth();

  // The server found no session while who-am-I still holds one (it expired between the two reads):
  // re-read who-am-I so the account control agrees, as a gated action's `auth_required` does.
  useEffect(() => {
    if (refusal === 'auth_required' && authenticated) void refresh();
  }, [refusal, authenticated, refresh]);

  if (refusal === 'owner_only') return <OwnerOnlyWall {...wall} />;
  if (refusal === 'auth_required') return <SignInWall {...wall} />;
  return <>{children}</>;
}

/** The private-testing wall: signed out, sign-ups closed, one way in, the demo, a free path. */
function SignInWall({ surface, demoPath, freePath }: WallProps) {
  const { subsystemDegraded, refresh } = useAuth();
  const { openAuth } = useAuthDialog();
  const signInRef = useRef<HTMLButtonElement>(null);
  const copy = wallCopy(surface);
  const free = freePath ?? { to: '/ticker', label: 'Open a ticker desk' };

  // Neutral outlined secondaries from the theme (owner ruling A, 2026-10-15): "Sign in" is the
  // wall's one amber action.
  const outlinedSx = { minHeight: 44, ...wallButtonFlex };
  return (
    <Box sx={wallOuterSx}>
      <Paper
        variant="outlined"
        component="section"
        aria-label={
          subsystemDegraded ? AUTH_COPY.gate.sessionUnknown : `Sign in to open ${surface}`
        }
        data-testid="require-auth-wall"
        sx={wallPanelSx}
      >
        <DataStateTag state="signIn" label="Private testing" />
        <Typography component="h1" sx={wallTitleSx}>
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
        <Box sx={wallButtonsSx}>
          <Button
            variant="contained"
            ref={signInRef}
            onClick={() => openAuth({ returnFocus: signInRef.current })}
            data-testid="require-auth-signin"
            sx={{ minHeight: 44, ...wallButtonFlex }}
          >
            {AUTH_COPY.account.signIn}
          </Button>
          {subsystemDegraded && (
            <Button
              variant="outlined"
              onClick={() => void refresh()}
              data-testid="require-auth-retry"
              sx={outlinedSx}
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
              sx={outlinedSx}
            >
              See it on the demo →
            </Button>
          )}
          <Button
            component={RouterLink}
            to={free.to}
            variant="outlined"
            data-testid="require-auth-ticker"
            sx={outlinedSx}
          >
            {free.label}
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
            sx={wallFootSx}
          >
            {copy.demo}
          </Typography>
        )}
      </Paper>
    </Box>
  );
}

/**
 * The owner gate's wall: a signed-in account the API refused with 403 `owner_only`. Spec 08's "Not
 * the owner" state, adapted from the journal to the tool: the sentence, "See it on the demo →", and
 * no state tag, since P-2 has no word for it (open question 12, answered 2026-10-28). No sign-in
 * either: the account is signed in, and signing in again can't change the answer.
 *
 * The same 403 comes back to every account, the owner's included, while `OWNER_EMAILS` is unset on
 * the API (it fails closed), and the page can't tell the two apart. So, as the planned boards do
 * for an unset variable (design/src/screens/final/planned.mjs, `nc()`), a collapsed line names it
 * for the site's operator.
 */
function OwnerOnlyWall({ surface, demoPath }: WallProps) {
  const copy = wallCopy(surface);
  return (
    <Box sx={wallOuterSx}>
      <Paper
        variant="outlined"
        component="section"
        aria-label={copy.ownerLabel}
        data-testid="owner-only-wall"
        sx={wallPanelSx}
      >
        {/* The sentence is the title, a step under the sign-in wall's 28px since it runs longer. */}
        <Typography component="h1" sx={{ ...wallTitleSx, fontSize: 24 }}>
          {copy.owner}
        </Typography>
        {demoPath && (
          <Box sx={wallButtonsSx}>
            <Button
              href={`${STAGING_DEMO_URL}${demoPath}`}
              variant="outlined"
              data-testid="owner-only-demo-link"
              sx={{ minHeight: 44, ...wallButtonFlex }}
            >
              See it on the demo →
            </Button>
          </Box>
        )}
        <Box
          component="details"
          data-testid="owner-only-operator"
          sx={{ ...wallFootSx, color: 'text.secondary' }}
        >
          {/* Under a coarse pointer the 44px target centres its one line, so the closed wall
              isn't bottom-heavy and the opened line follows its summary closely. */}
          <Box
            component="summary"
            sx={[
              { cursor: 'pointer', minHeight: 24 },
              coarseFloor,
              { '@media (pointer: coarse)': { lineHeight: '44px' } },
            ]}
          >
            For the site’s operator
          </Box>
          <Box component="span" sx={{ ...MONO_FACE, fontSize: 11 }}>
            Set OWNER_EMAILS on the API
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}

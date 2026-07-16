/**
 * TopNav — the persistent top navigation bar (its own UI component; the Figma "Top-nav bar", node
 * `36:41`). Extracted from `AppShell` so the bar is a standalone, testable, reusable component and the
 * shell is just the route layout.
 *
 * Chrome ONLY: owns no feature data, makes no fetch, opens no SSE. Frosted/translucent sticky bar,
 * content constrained to the 1240 column. Active-route highlight per `NAV`.
 *
 * Binding (AC-Inv-7 / `[operator-vs-trader-path-separation]`): NO link/button to `/_ops/metrics` —
 * the operator route is reachable only by typing the URL.
 */
import { AppBar, Box, Stack, Toolbar, useScrollTrigger } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { NavLink, Link as RouterLink, useLocation } from 'react-router-dom';
import { AccountControl } from '@/features/auth/AccountControl';
import { elevationFor } from '@/shared/theme/tokens';
import { ConvexaMark } from './ConvexaMark';

interface NavEntry {
  label: string;
  to: string;
  /** Predicate: is this entry active for the current path? */
  active: (path: string) => boolean;
}

// Active-route rules (UX_BLUEPRINT §2): Ticker matches `/ticker*`; Positions `/positions`; Scanner
// `/scanner`; Blog `/blog` (owner-added 2026-07-16 — the static article pages under `/blog/*.html`
// are full-document loads outside the SPA, so only the index route needs a highlight rule).
// Deliberately NO operator entry.
const NAV: NavEntry[] = [
  { label: 'Ticker', to: '/ticker', active: (p) => p.startsWith('/ticker') },
  {
    label: 'Positions',
    to: '/positions',
    active: (p) => p === '/positions' || p.startsWith('/positions/'),
  },
  {
    label: 'Scanner',
    to: '/scanner',
    active: (p) => p === '/scanner' || p.startsWith('/scanner/'),
  },
  {
    label: 'Blog',
    to: '/blog',
    active: (p) => p === '/blog' || p.startsWith('/blog/'),
  },
];

export function TopNav() {
  const location = useLocation();
  const path = location.pathname;
  // Scroll-aware chrome: flush with the hero at the top (no border/shadow, blends in), then detaches
  // from the scrolling page with a divider border + e2 elevation once any content passes under it.
  const scrolled = useScrollTrigger({ disableHysteresis: true, threshold: 0 });

  return (
    <AppBar
      position="sticky"
      elevation={0}
      data-testid="top-nav"
      sx={{
        // Translucent, blurred chrome (README §1) — frosted glass over the dark canvas; the frost
        // firms up slightly once scrolled.
        bgcolor: (t) => alpha(t.palette.background.paper, scrolled ? 0.9 : 0.82),
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: 1,
        borderColor: scrolled ? 'divider' : 'transparent',
        boxShadow: (t) => (scrolled ? elevationFor(t).e2 : 'none'),
        transition: 'background-color 200ms ease, border-color 200ms ease, box-shadow 200ms ease',
      }}
    >
      {/* Full-bleed bar; content constrained to the 1240 content column with 24px gutters. */}
      <Toolbar disableGutters sx={{ px: 0 }}>
        <Box
          sx={{
            width: '100%',
            maxWidth: 1240,
            mx: 'auto',
            px: 3,
            minHeight: 60,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          {/* Wordmark links to `/` (the landing — the honest front door, NOT the operator route). */}
          <Box
            component={RouterLink}
            to="/"
            data-testid="shell-brand"
            sx={{
              color: 'text.primary',
              textDecoration: 'none',
              display: 'inline-flex',
              opacity: 0.95,
              transition: 'opacity 160ms ease',
              '&:hover': { opacity: 1 },
            }}
          >
            <ConvexaMark size={18} fontSize="1.15rem" />
          </Box>

          <Stack direction="row" spacing={2} component="nav" aria-label="primary">
            {NAV.map((e) => {
              const isActive = e.active(path);
              return (
                <Box
                  key={e.to}
                  component={NavLink}
                  to={e.to}
                  data-testid={`nav-${e.label.toLowerCase()}`}
                  aria-current={isActive ? 'page' : undefined}
                  sx={{
                    textDecoration: 'none',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    py: 2,
                    color: isActive ? 'primary.main' : 'text.secondary',
                    borderBottom: 2,
                    borderColor: isActive ? 'primary.main' : 'transparent',
                    transition: 'color 160ms ease, border-color 160ms ease',
                    // Subtle primary glow under the active item — cohesive with the card polish.
                    boxShadow: (t) =>
                      isActive ? `0 2px 12px -6px ${alpha(t.palette.primary.main, 0.8)}` : 'none',
                    '&:hover': { color: isActive ? 'primary.main' : 'text.primary' },
                  }}
                >
                  {e.label}
                </Box>
              );
            })}
          </Stack>

          {/* Account control (UX_BLUEPRINT §2.1) — top-right. Loading / login·signup / account menu.
              Non-blocking: the rest of the app renders regardless of who-am-I. */}
          <Box sx={{ flexGrow: 1 }} />
          <AccountControl />
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default TopNav;

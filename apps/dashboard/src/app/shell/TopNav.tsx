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
import { AppBar, Toolbar, Box, Stack } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Link as RouterLink, NavLink, useLocation } from 'react-router-dom';
import { ConvexaMark } from './ConvexaMark';
import { AccountControl } from '../auth/AccountControl';

interface NavEntry {
  label: string;
  to: string;
  /** Predicate: is this entry active for the current path? */
  active: (path: string) => boolean;
}

// Active-route rules (UX_BLUEPRINT §2): Ticker matches `/ticker*`; Positions `/positions`; Scanner
// `/scanner`. Deliberately NO operator entry.
const NAV: NavEntry[] = [
  { label: 'Ticker', to: '/ticker', active: (p) => p.startsWith('/ticker') },
  { label: 'Positions', to: '/positions', active: (p) => p === '/positions' || p.startsWith('/positions/') },
  { label: 'Scanner', to: '/scanner', active: (p) => p === '/scanner' || p.startsWith('/scanner/') },
];

export function TopNav() {
  const location = useLocation();
  const path = location.pathname;

  return (
    <AppBar
      position="sticky"
      elevation={0}
      data-testid="top-nav"
      sx={{
        // Translucent, blurred chrome (README §1) — frosted glass over the dark canvas.
        bgcolor: (t) => alpha(t.palette.background.paper, 0.82),
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: 1,
        borderColor: 'divider',
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
                    boxShadow: isActive ? '0 2px 12px -6px rgba(79, 156, 255, 0.8)' : 'none',
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

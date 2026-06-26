/**
 * AppShell — the persistent nav chrome for the in-shell trader pages (UX_BLUEPRINT §2, ARCHITECTURE
 * §2). Replaces today's bare `<AppBar>GammaFlow</AppBar>`. It is a PARENT ROUTE rendering `<Outlet/>`,
 * so it mounts once for the in-shell group and does NOT remount across Ticker ↔ Positions ↔ Scanner
 * (AC-Nav-4) — the page content swaps in the outlet, the bar persists.
 *
 * Chrome ONLY: it owns no feature data, makes no fetch, opens no SSE. A page-level error renders inside
 * the outlet and never blanks this bar (AC-Inv-2 page isolation).
 *
 * Binding (AC-Inv-7 / `[operator-vs-trader-path-separation]`): NO link/button/menu item to
 * `/_ops/metrics`. The operator route stays reachable only by typing the URL.
 */
import { AppBar, Toolbar, Box, Stack } from '@mui/material';
import { Link as RouterLink, NavLink, Outlet, useLocation } from 'react-router-dom';
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

export function AppShell() {
  const location = useLocation();
  const path = location.pathname;

  return (
    <Box data-testid="app-shell">
      <AppBar
        position="static"
        elevation={0}
        sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}
      >
        <Toolbar sx={{ gap: 3 }}>
          {/* Wordmark links to `/` (the landing — the honest front door, NOT the operator route). */}
          <Box
            component={RouterLink}
            to="/"
            data-testid="shell-brand"
            sx={{ color: 'text.primary', textDecoration: 'none', display: 'inline-flex' }}
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
                    '&:hover': { color: isActive ? 'primary.main' : 'text.primary' },
                  }}
                >
                  {e.label}
                </Box>
              );
            })}
          </Stack>

          {/* Account control (UX_BLUEPRINT §2.1) — top-right. Loading / Sign in / account menu.
              Non-blocking: the rest of the app renders regardless of who-am-I. */}
          <Box sx={{ flexGrow: 1 }} />
          <AccountControl />
        </Toolbar>
      </AppBar>

      {/* The active in-shell page renders here. The bar above persists across page swaps. */}
      <Outlet />
    </Box>
  );
}

export default AppShell;

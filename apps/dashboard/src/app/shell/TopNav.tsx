/**
 * TopNav — the persistent top navigation bar (its own UI component; the Figma "Top-nav bar", node
 * `36:41`). Extracted from `AppShell` so the bar is a standalone, testable, reusable component and the
 * shell is just the route layout.
 *
 * Chrome ONLY: owns no feature data, makes no fetch, opens no SSE. Frosted/translucent sticky bar,
 * content constrained to the 1240 column. Active-route highlight per `NAV`.
 *
 * Responsive: at `md+` the primary nav is an inline row. Below `md` it collapses to a hamburger that
 * opens a temporary Drawer (the drawer's links unmount when closed, so they don't duplicate the inline
 * `nav-*` testids). The wordmark + AccountControl stay in the bar at every width.
 *
 * Binding (AC-Inv-7 / `[operator-vs-trader-path-separation]`): NO link/button to `/_ops/metrics` —
 * the operator route is reachable only by typing the URL.
 */
import { AccountControl } from '@/features/auth/AccountControl';
import {
  prefetchPositionsRoute,
  prefetchScannerRoute,
  prefetchStructureFieldLabRoute,
  prefetchTickerRoute,
} from '@/shared/lib/prefetchRoutes';
import { elevationFor } from '@/shared/theme/tokens';
import CloseIcon from '@mui/icons-material/Close';
import MenuIcon from '@mui/icons-material/Menu';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Toolbar from '@mui/material/Toolbar';
import useScrollTrigger from '@mui/material/useScrollTrigger';
import { useState } from 'react';
import { NavLink, Link as RouterLink, useLocation } from 'react-router-dom';
import { ConvexaMark } from './ConvexaMark';

interface NavEntry {
  label: string;
  to: string;
  /** Predicate: is this entry active for the current path? */
  active: (path: string) => boolean;
}

function warmNav(to: string) {
  if (to.startsWith('/ticker')) void prefetchTickerRoute();
  else if (to.startsWith('/scanner')) void prefetchScannerRoute();
  else if (to.startsWith('/positions')) void prefetchPositionsRoute();
  else if (to.startsWith('/lab')) void prefetchStructureFieldLabRoute();
}

// Product spine (where → why → track): Scanner first, then Ticker, Positions, Alerts, Blog.
// Lab is a public Canvas instrument demo (not product spine, but discoverable).
// Active-route rules: Scanner `/scanner*`; Ticker `/ticker*`; Positions `/positions*`; etc.
// Deliberately NO operator entry (`/_ops/metrics` and `/_ops/research` are URL-only).
const NAV: NavEntry[] = [
  {
    label: 'Scanner',
    to: '/scanner',
    active: (p) => p === '/scanner' || p.startsWith('/scanner/'),
  },
  { label: 'Ticker', to: '/ticker', active: (p) => p.startsWith('/ticker') },
  {
    label: 'Positions',
    to: '/positions',
    active: (p) => p === '/positions' || p.startsWith('/positions/'),
  },
  {
    label: 'Alerts',
    to: '/alerts',
    active: (p) => p === '/alerts' || p.startsWith('/alerts/'),
  },
  {
    label: 'Lab',
    to: '/lab',
    active: (p) => p === '/lab' || p.startsWith('/lab/'),
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
  const [drawerOpen, setDrawerOpen] = useState(false);
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
      {/* Full-bleed bar; content constrained to the 1240 content column with responsive gutters. */}
      <Toolbar disableGutters sx={{ px: 0 }}>
        <Box
          sx={{
            width: '100%',
            maxWidth: 1240,
            mx: 'auto',
            px: { xs: 2, md: 3 },
            minHeight: { xs: 56, md: 60 },
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1.5, md: 3 },
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

          {/* Inline primary nav — md and up only. */}
          <Stack
            direction="row"
            spacing={2}
            component="nav"
            aria-label="primary"
            sx={{ display: { xs: 'none', md: 'flex' } }}
          >
            {NAV.map((e) => {
              const isActive = e.active(path);
              return (
                <Box
                  key={e.to}
                  component={NavLink}
                  to={e.to}
                  data-testid={`nav-${e.label.toLowerCase()}`}
                  aria-current={isActive ? 'page' : undefined}
                  onMouseEnter={() => warmNav(e.to)}
                  onFocus={() => warmNav(e.to)}
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

          {/* Hamburger — below md only. Opens the nav drawer. */}
          <IconButton
            edge="end"
            aria-label="Open navigation menu"
            data-testid="nav-menu-button"
            onClick={() => setDrawerOpen(true)}
            sx={{ display: { xs: 'inline-flex', md: 'none' }, color: 'text.primary' }}
          >
            <MenuIcon />
          </IconButton>
        </Box>
      </Toolbar>

      {/* Mobile nav drawer — temporary (unmounts links when closed, so no duplicate nav testids). */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        data-testid="nav-drawer"
        slotProps={{ paper: { sx: { width: 'min(80vw, 300px)' } } }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
          }}
        >
          <ConvexaMark size={18} fontSize="1.15rem" />
          <IconButton
            aria-label="Close navigation menu"
            data-testid="nav-drawer-close"
            onClick={() => setDrawerOpen(false)}
            sx={{ color: 'text.primary' }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
        <Divider />
        <List component="nav" aria-label="primary-mobile" sx={{ py: 1 }}>
          {NAV.map((e) => {
            const isActive = e.active(path);
            return (
              <ListItemButton
                key={e.to}
                component={NavLink}
                to={e.to}
                data-testid={`nav-drawer-${e.label.toLowerCase()}`}
                aria-current={isActive ? 'page' : undefined}
                onMouseEnter={() => warmNav(e.to)}
                onFocus={() => warmNav(e.to)}
                onClick={() => setDrawerOpen(false)}
                selected={isActive}
                sx={{
                  minHeight: 48, // comfortable touch target
                  '&.Mui-selected': { bgcolor: (t) => alpha(t.palette.primary.main, 0.12) },
                }}
              >
                <ListItemText
                  primary={e.label}
                  slotProps={{
                    primary: {
                      sx: {
                        fontWeight: 600,
                        color: isActive ? 'primary.main' : 'text.primary',
                      },
                    },
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Drawer>
    </AppBar>
  );
}

export default TopNav;

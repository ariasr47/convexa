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
 * Under the five links the drawer carries the account rows (design/src/screens/final/
 * shell-site-kit.mjs drawerF): production has Settings, “Log in” while signed out (sign-ups are
 * closed, so never “Sign up”) and “What’s live on this site” (/methodology#data); staging has the
 * demo account's line, Settings and “Reset demo data”, which asks first through the same
 * confirmation as the demo bar. Staging never says “Log in”.
 *
 * Binding (AC-Inv-7 / `[operator-vs-trader-path-separation]`): NO link/button to `/_ops/metrics` —
 * the operator route is reachable only by typing the URL.
 */
import { AccountControl } from '@/features/auth/AccountControl';
import { useAuth } from '@/features/auth/AuthContext';
import { useAuthDialog } from '@/features/auth/AuthDialogProvider';
import { avatarInitial } from '@/features/auth/avatar';
import { STAGING_DEMO_URL } from '@/shared/lib/demoSite';
import {
  prefetchPositionsRoute,
  prefetchScannerRoute,
  prefetchTickerRoute,
} from '@/shared/lib/prefetchRoutes';
import { elevationFor, extrasFor, typographyTokens } from '@/shared/theme/tokens';
import { dataMode, resetDemoWorkspace } from '@convexa/api';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardCommandKeyOutlined from '@mui/icons-material/KeyboardCommandKeyOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
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
import { ResetDemoControl } from './ResetDemoControl';

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
}

// (v2) Product spine (canon rule 19, curvature-v2-foundations): Scanner, Ticker, Research,
// Positions, Alerts. Research joined 2026-10-12 (rule 19 amendment): it is the production site's
// working surface while market data is paused. Lab and Blog move to the footer — AC-23.
// Active-route rules: Scanner `/scanner*`; Ticker `/ticker*` except a ticker's research tab, which
// lights Research with `/research*`; Positions `/positions*`; etc.
// Deliberately NO operator entry (`/_ops/metrics` and `/_ops/research` are URL-only) — AC-23b.
const isTickerResearch = (p: string) => /^\/ticker\/[^/]+\/research(\/|$)/.test(p);
const NAV: NavEntry[] = [
  {
    label: 'Scanner',
    to: '/scanner',
    active: (p) => p === '/scanner' || p.startsWith('/scanner/'),
  },
  {
    label: 'Ticker',
    to: '/ticker',
    active: (p) => p.startsWith('/ticker') && !isTickerResearch(p),
  },
  {
    label: 'Research',
    to: '/research',
    active: (p) => p === '/research' || p.startsWith('/research/') || isTickerResearch(p),
  },
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
];

export interface TopNavProps {
  /**
   * (v2) The ⌘K palette trigger (SPEC §2.6/§4.4 P1). `TopNav` owns only the AFFORDANCE — the
   * field/icon that opens it — never the palette itself or the global keyboard listener; those are
   * `AppShell`'s (curvature-v2-foundations FE-9). Absent → the affordance renders inert (no-op),
   * which is the correct state until FE-9 wires it.
   */
  onOpenPalette?: () => void;
}

export function TopNav({ onOpenPalette }: TopNavProps = {}) {
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
        // firms up slightly once scrolled. v2 `glass` (SPEC §2.1): the RESTING arm is theme-derived
        // — dark is exactly `alpha(panel #131A24, 0.82)`, so this renders byte-identical to the
        // prior computed value; light's 0.86 is the design mirror's own deliberate value, not a
        // computation match. NAMED GAP: no token exists yet for the SCROLLED 0.9 state, which keeps
        // its computed alpha (derived from a palette slot, so not a new hardcoded literal).
        bgcolor: (t) => (scrolled ? alpha(t.palette.background.paper, 0.9) : extrasFor(t).glass),
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
            // `xs` tightened from 1.5→1 (curvature-v2-foundations AC-40, measured): signed-OUT at
            // 393px the row carries brand + the N5 search-icon affordance + BOTH "Log in"/"Sign up"
            // + the hamburger simultaneously — a combination no prior overflow test exercised (every
            // existing overflow check ran signed-in, where AccountControl renders one
            // narrower avatar control instead of two buttons). Measured real overflow: scrollWidth
            // 410 vs innerWidth 393 (17px), reproduced live and fixed here plus the two `size="small"`
            // trims below (24px reclaimed total) — never touching `AccountControl` (its buttons are
            // already `size="small"`) or hiding the icon (SPEC N5 requires it visible for the WHOLE
            // <1100px range, not just tablet).
            gap: { xs: 1, md: 3 },
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
                    // The active item is carried by WEIGHT and the amber UNDERLINE (P-6; owner
                    // ruling A, 2026-10-15): its label is `text.primary`, never amber text — the
                    // Final shell board's `.nav-links a.on`. Inactive labels are steel at 500.
                    fontWeight: isActive ? 600 : 500,
                    py: 2,
                    color: isActive ? 'text.primary' : 'text.secondary',
                    borderBottom: 2,
                    borderColor: isActive ? 'primary.main' : 'transparent',
                    transition: 'color 160ms ease, border-color 160ms ease',
                    // Subtle primary glow under the active item — cohesive with the card polish.
                    // A border/glow is a UI component (≥3:1 floor), never TEXT.
                    boxShadow: (t) =>
                      isActive ? `0 2px 12px -6px ${alpha(t.palette.primary.main, 0.8)}` : 'none',
                    '&:hover': { color: 'text.primary' },
                  }}
                >
                  {e.label}
                </Box>
              );
            })}
          </Stack>

          <Box sx={{ flexGrow: 1 }} />

          {/* (v2) The ⌘K palette affordance (SPEC §2.6/§4.4 P1 · N5) — laptop (1100px, FE-2's
              additive key) and up: the full field + kbd hint. Below that: an icon button only, and
              "the ⌘K hint drops with the field and the shortcut still works" (the global listener
              lives in AppShell, unaffected by this element's width). */}
          <Box
            component="button"
            type="button"
            onClick={onOpenPalette}
            data-testid="nav-search-trigger"
            aria-label="Jump to a ticker or note"
            sx={(t) => ({
              display: { xs: 'none', laptop: 'flex' },
              alignItems: 'center',
              gap: 1,
              height: 36,
              minWidth: 200,
              px: 1.5,
              // CONTROL role = 8px (SPEC §2.2, ruling 4) — theme-derived multiplier, not a literal.
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: extrasFor(t).well,
              color: 'text.secondary',
              font: 'inherit',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              transition: 'border-color 160ms ease, color 160ms ease',
              '&:hover': { color: 'text.primary', borderColor: 'text.disabled' },
            })}
          >
            <SearchIcon sx={{ fontSize: 16 }} aria-hidden />
            <Box component="span" sx={{ flexGrow: 1, textAlign: 'left' }}>
              Jump to a ticker or note
            </Box>
            <Box
              component="span"
              aria-hidden
              sx={{
                fontSize: 11,
                // PR #46 CI repair, §B — was the bare CSS keyword `monospace` (never a declared
                // face): resolved to whatever the HOST calls its default monospace font, which is
                // exactly why the "⌘" glyph rendered differently per platform. Bound to the design
                // token instead, matching every other data/figure face in the app.
                fontFamily: typographyTokens.monoFontFamily,
                lineHeight: 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '1px',
                // On the declared 4-pt ladder from birth (SPEC §2.2): 1 × 8px, not the off-ladder 6px.
                px: 1,
                py: 0.5,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                // PR #46 CI repair, §A — `text.disabled` measured 2.56:1 (dark) / 2.65:1 (light),
                // under WCAG AA 4.5:1: `text.disabled` means a disabled CONTROL, and this is
                // informative text (a live keyboard hint), not a disabled affordance. Bound to
                // `text.secondary` instead (steel ≈5.7–6.8:1 on every real dark surface it sits on)
                // — the bordered kbd chrome, not colour, is what marks it "quiet".
                color: 'text.secondary',
              }}
            >
              {/* PR #46 CI repair, §B — U+2318 (⌘) is not in IBM Plex Sans/Mono at all (verified: no
                  fontsource subset, no full upstream Plex source, carries this glyph), so no bundled
                  font can render it; it fell back to the HOST's symbol font, a second host-dependent
                  surface beside the `fontFamily: 'monospace'` fix above. Replaced with the app's
                  existing icon system (`@mui/icons-material`, bundled in the JS bundle — the same
                  host-independence a stroke SVG would give, and the pattern this file already uses
                  for Search/Menu/Close) rather than a literal character. "K" stays real bundled text
                  (plain ASCII, covered by every Plex Mono subset already shipped). */}
              <KeyboardCommandKeyOutlined sx={{ fontSize: 12 }} />K
            </Box>
          </Box>
          <IconButton
            onClick={onOpenPalette}
            aria-label="Jump to a ticker or note"
            data-testid="nav-search-icon"
            // `size="small"` (AC-40 overflow fix): trims the CSS-default hit box a few px on a mouse
            // — real touch devices are unaffected, since `theme.ts`'s `@media (pointer: coarse)`
            // floor targets the bare `button` element unconditionally (independent of MUI's `size`).
            size="small"
            sx={{ display: { xs: 'inline-flex', laptop: 'none' }, color: 'text.primary' }}
          >
            <SearchIcon fontSize="small" />
          </IconButton>

          {/* Production's front door (owner, 2026-10-16): the full demo, one neutral click away on
              every page. Most of the desk needs a paid options feed this site doesn't have; the
              demo runs all of it on a sample day. Not on the demo build itself. */}
          {dataMode !== 'demo' && (
            <Button
              href={STAGING_DEMO_URL}
              variant="outlined"
              size="small"
              data-testid="nav-full-demo"
              sx={{ display: { xs: 'none', md: 'inline-flex' }, whiteSpace: 'nowrap' }}
            >
              Full demo ↗
            </Button>
          )}

          {/* Account control (UX_BLUEPRINT §2.1) — top-right. Loading / login·signup / account menu.
              Non-blocking: the rest of the app renders regardless of who-am-I. */}
          {/* The demo is always signed in to its seed account (owner, 2026-10-14), so it shows
              the same signed-in control as a live account. */}
          <AccountControl />

          {/* Hamburger — below md only. Opens the nav drawer. `size="small"` — same AC-40 note as
              the search icon above; the coarse-pointer floor still guarantees ≥44px on a real touch
              device regardless. */}
          <IconButton
            edge="end"
            aria-label="Open navigation menu"
            data-testid="nav-menu-button"
            onClick={() => setDrawerOpen(true)}
            size="small"
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
                  // The Final drawer board (`.ss-drawer a[aria-current]`): a raised row with a 3px
                  // amber edge carries the active item; the label stays `text.primary` (ruling A).
                  '&.Mui-selected, &.Mui-selected:hover': {
                    bgcolor: (t) => extrasFor(t).panelRaised,
                    boxShadow: (t) => `inset 3px 0 0 ${t.palette.primary.main}`,
                  },
                }}
              >
                <ListItemText
                  primary={e.label}
                  slotProps={{
                    primary: {
                      sx: { fontWeight: 600, color: 'text.primary' },
                    },
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>
        <Divider />
        <DrawerAccountRows onNavigate={() => setDrawerOpen(false)} />
      </Drawer>
    </AppBar>
  );
}

/** The quieter 48px rows under the five links (drawerF's `a.q`). */
const quietRowSx = {
  minHeight: 48,
  fontSize: 14,
  fontWeight: 500,
  color: 'text.secondary',
  '&:hover': { color: 'text.primary' },
} as const;

/** The drawer's account rows. `onNavigate` closes the drawer before a link or the sign-in dialog
 *  takes over; the reset confirmation opens over the drawer and keeps it open. */
function DrawerAccountRows({ onNavigate }: { onNavigate: () => void }) {
  const auth = useAuth();
  const { openAuth } = useAuthDialog();
  const demo = dataMode === 'demo';
  return (
    <List component="div" aria-label="Account" sx={{ py: 1 }} data-testid="nav-drawer-account">
      {demo && (
        <Box
          data-testid="nav-drawer-demo-account"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            minHeight: 48,
            px: 2,
            fontSize: 14,
            color: 'text.secondary',
          }}
        >
          <Box
            component="span"
            aria-hidden
            sx={(t) => ({
              width: 32,
              height: 32,
              borderRadius: '50%',
              flex: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 600,
              bgcolor: extrasFor(t).panelRaised2,
              color: 'text.primary',
            })}
          >
            {avatarInitial(auth.user)}
          </Box>
          {auth.user?.display_name || 'Demo account'}
        </Box>
      )}
      <ListItemButton
        component={RouterLink}
        to="/settings"
        onClick={onNavigate}
        data-testid="nav-drawer-settings"
        sx={quietRowSx}
      >
        Settings
      </ListItemButton>
      {!demo && auth.ready && !auth.authenticated && (
        <ListItemButton
          onClick={() => {
            onNavigate();
            openAuth({ mode: 'login' });
          }}
          data-testid="nav-drawer-login"
          sx={quietRowSx}
        >
          Log in
        </ListItemButton>
      )}
      {!demo && (
        <ListItemButton
          component="a"
          href={STAGING_DEMO_URL}
          onClick={onNavigate}
          data-testid="nav-drawer-full-demo"
          sx={quietRowSx}
        >
          See the full demo ↗
        </ListItemButton>
      )}
      {!demo && (
        <ListItemButton
          component={RouterLink}
          to="/methodology#data"
          onClick={onNavigate}
          data-testid="nav-drawer-whats-live"
          sx={quietRowSx}
        >
          What’s live on this site
        </ListItemButton>
      )}
      {demo && (
        <Box sx={{ px: 1.25, pt: 0.5, display: 'flex', flexDirection: 'column' }}>
          <ResetDemoControl onReset={resetDemoWorkspace} placement="drawer" />
        </Box>
      )}
    </List>
  );
}

export default TopNav;

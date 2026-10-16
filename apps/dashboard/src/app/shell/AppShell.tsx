/**
 * AppShell — the persistent route LAYOUT for the in-shell pages (UX_BLUEPRINT §2, ARCHITECTURE §2). A
 * PARENT ROUTE rendering `<TopNav/>` + `<Outlet/>`, so the bar mounts once for the in-shell group and
 * does NOT remount across `/` ↔ Ticker ↔ Positions ↔ Scanner (AC-Nav-4) — the page content swaps in
 * the outlet, the bar persists.
 *
 * The bar itself is its own component, `TopNav` (the Figma "Top-nav bar"). AppShell owns no feature
 * data, makes no fetch, opens no SSE — a page-level error renders inside the outlet and never blanks
 * the bar (AC-Inv-2 page isolation).
 *
 * Product spine #6 — keyboard: a skip link is the first tab stop, targeting the ONE `<main>` landmark.
 */
import { extrasFor } from '@/shared/theme/tokens';
import {
  dataMode,
  demoClock,
  resetDemoWorkspace,
  resumeDemoPlayback,
  subscribeDemoClock,
  type DemoClock,
} from '@convexa/api';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { CommandPalette } from './CommandPalette/CommandPalette';
import { Footer } from './Footer';
import { MarketDataNotice } from './MarketDataNotice';
import { ResetDemoControl } from './ResetDemoControl';
import { GO_TO, GO_TO_WINDOW_MS, isPlainKey, isTypingTarget } from './shortcuts';
import { ShortcutsSheet } from './ShortcutsSheet';
import { TopNav } from './TopNav';
import { useScrollToTopOnPageChange } from './useScrollToTopOnPageChange';

export function AppShell() {
  // (v2) The ⌘K palette — mounted ONCE in the shell so "one keystroke anywhere" holds on every
  // in-shell route (SPEC §2.6). NOT mounted on `/` — landing sits outside AppShell (canon rule 19
  // scopes the palette to the shell). Fires REGARDLESS of what currently holds focus — including a
  // text field (AC-33 requires the palette to open while a field holds unsaved text) — because
  // ⌘K/Ctrl-K is never a text-INSERTION key in any browser or OS; unlike a plain letter, it carries
  // no risk of "fighting" a form field, so no typing-target guard is needed (or correct: VS Code /
  // Linear / Notion all fire their palette shortcut from inside a focused field the same way).
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [playback, setPlayback] = useState<DemoClock | null>(() => demoClock());
  useEffect(() => {
    if (dataMode !== 'demo') return;
    return subscribeDemoClock((clock) =>
      setPlayback((current) => (current?.playback === clock.playback ? current : clock)),
    );
  }, []);
  // The single-key shortcuts (shortcuts.ts): `/` opens the palette, `g` then a letter goes to a
  // section, `?` opens the sheet. Unlike ⌘K these insert text, so none fires while typing or while
  // a dialog holds focus.
  const [sheetOpen, setSheetOpen] = useState(false);
  const navigate = useNavigate();
  const goPending = useRef<number | null>(null);

  // A link to another page opens it at the top; a query-string rewrite on the same page does not.
  useScrollToTopOnPageChange();
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isOpenShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isOpenShortcut) {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (event.defaultPrevented || event.repeat || !isPlainKey(event)) return;
      if (isTypingTarget(event.target)) return;
      const armed = goPending.current !== null && Date.now() - goPending.current <= GO_TO_WINDOW_MS;
      goPending.current = null;
      if (armed) {
        const dest = GO_TO[event.key.toLowerCase()];
        if (dest && !event.shiftKey) {
          event.preventDefault();
          navigate(dest.to);
          return;
        }
      }
      if (event.key === '/') {
        event.preventDefault();
        setPaletteOpen(true);
      } else if (event.key === '?') {
        event.preventDefault();
        setSheetOpen(true);
      } else if (event.key === 'g' && !event.shiftKey) {
        goPending.current = Date.now();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  return (
    <Box
      data-testid="app-shell"
      sx={{
        // Notch / home-indicator safe areas (device review 5.6).
        pt: 'env(safe-area-inset-top)',
        pl: 'env(safe-area-inset-left)',
        pr: 'env(safe-area-inset-right)',
      }}
    >
      {/* Skip link — visually hidden until keyboard focus (spine #6). First tab stop. */}
      <Box
        component="a"
        href="#main-content"
        data-testid="skip-to-main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
        sx={(theme) => ({
          position: 'absolute',
          left: 0,
          top: 0,
          zIndex: theme.zIndex.tooltip + 1,
          px: 1.5,
          py: 1,
          minHeight: 44,
          minWidth: 44,
          display: 'inline-flex',
          alignItems: 'center',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: theme.palette.primary.contrastText,
          bgcolor: theme.palette.primary.main,
          borderRadius: '0 0 8px 0',
          textDecoration: 'none',
          // Park off-screen until keyboard focus; do not use display:none (unfocusable).
          transform: 'translateY(-120%)',
          transition: 'transform 120ms ease',
          '&:focus, &:focus-visible': {
            transform: 'translateY(0)',
            outline: `2px solid ${extrasFor(theme).textAmber}`,
            outlineOffset: 2,
          },
          '@media (prefers-reduced-motion: reduce)': {
            transition: 'none',
          },
        })}
      >
        Skip to main content
      </Box>
      {dataMode === 'demo' && playback && (
        <Box
          role="status"
          aria-label="Demo scenario provenance"
          data-testid="demo-provenance"
          sx={{
            px: { xs: 2, md: 3 },
            py: 1,
            bgcolor: 'background.paper',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={0.5}
            sx={{ alignItems: { xs: 'stretch', sm: 'center' }, flexWrap: 'wrap' }}
          >
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary' }}>
              Demo · sample data
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Authored scenario · October 7, 2026 · no market feed connected
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Signed in as the demo account
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            {playback.playback === 'paused' && (
              <>
                <Typography variant="caption" color="text.secondary">
                  Simulated playback paused. Showing the last sample.
                </Typography>
                <Button size="small" onClick={resumeDemoPlayback} sx={{ minHeight: 44 }}>
                  Retry demo
                </Button>
              </>
            )}
            {playback.playback === 'ended' && (
              <Typography variant="caption" color="text.secondary">
                Sample playback complete. Showing the last sample.
              </Typography>
            )}
            <ResetDemoControl onReset={resetDemoWorkspace} />
          </Stack>
        </Box>
      )}
      {dataMode === 'live' && <MarketDataNotice />}
      <TopNav onOpenPalette={() => setPaletteOpen(true)} />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onOpenShortcuts={() => {
          setPaletteOpen(false);
          setSheetOpen(true);
        }}
      />
      <ShortcutsSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      {/* The active in-shell page renders here, inside the app's ONE `<main>` landmark (Stage 0
          item 3). id anchors the skip link (spine #6). The bar above persists across page swaps. */}
      <Box
        component="main"
        id="main-content"
        tabIndex={-1}
        sx={{
          // Keep content clear of home indicator on notched phones.
          pb: 'env(safe-area-inset-bottom)',
          // Avoid horizontal overflow on narrow phones.
          overflowX: 'clip',
          minWidth: 0,
        }}
      >
        <Outlet />
      </Box>
      {/* Canon rule 19 — Lab and Blog live in the footer, so the footer must reach every full page.
          ONE mount point is what makes "reachable from every in-shell page" STRUCTURAL instead of a
          checklist someone forgets; a route allow-list re-introduces the list. It necessarily puts a
          footer under the ticker desk — that cost is NAMED AND PAID (SPEC §8), not hidden by
          narrowing the criterion. Chrome, outside the <main> landmark, below the instrument. */}
      <Footer />
    </Box>
  );
}

export default AppShell;

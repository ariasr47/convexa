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
import { pageColumnSx } from '@/shared/ui/PageColumn';
import { WidgetProvenanceProvider } from '@/shared/ui/Widget/WidgetProvenanceContext';
import {
  dataMode,
  demoClock,
  resetDemoWorkspace,
  resumeDemoPlayback,
  subscribeDemoClock,
  type DemoClock,
} from '@convexa/api';
import CropFreeOutlined from '@mui/icons-material/CropFreeOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import type { SxProps, Theme } from '@mui/material/styles';
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

// The demo bar's phone line (below 600px) and its wide row share the glyph, the bold run and Reset.
const PHONE_ONLY = { display: { xs: 'inline', sm: 'none' } } as const;
const WIDE_ONLY = { display: { xs: 'none', sm: 'inline' } } as const;

/** The bar's separator: its own `aria-hidden` span holding only "·"; the row's 6px gap spaces it. */
function BarSeparator({ sx }: { sx?: SxProps<Theme> }) {
  return (
    <Typography variant="caption" color="text.secondary" aria-hidden sx={sx}>
      ·
    </Typography>
  );
}

/**
 * Below 600px, a full-width, zero-height flex item: whatever follows it starts a line of its own.
 * The row's 0 row gap means it adds no height. From 600px up it is gone and a separator stands in.
 */
function PhoneLineBreak() {
  return (
    <Box aria-hidden sx={{ flexBasis: '100%', height: 0, display: { xs: 'block', sm: 'none' } }} />
  );
}

export function AppShell() {
  // (v2) The ⌘K palette — mounted ONCE in the shell so "one keystroke anywhere" holds on every
  // in-shell route (SPEC §2.6). Landing is the shell's index route, so that includes `/` (canon
  // rule 19 scopes the palette to the shell). Fires REGARDLESS of what currently holds focus — including a
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
            // The phone line has no vertical padding: the 44px Reset sets its height (45px with the
            // border), so the bar costs one line of the first screen, not four (spec 01, step 1).
            py: { xs: 0, sm: 1 },
            bgcolor: 'background.paper',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          {/* The one page column, as the nav and the production bar (owner, NO-2 B, 2026-10-25:
              bar, nav and page share one edge; this supersedes spec 01's 1240 column). It keeps
              spec 01's 6px column gap and no row gap: MarketDataNotice's 12/4 gaps wrap the wide
              row a line early (spec 01, Behaviour › The demo bar). */}
          <Box
            sx={{
              ...pageColumnSx,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              columnGap: '6px',
              rowGap: 0,
            }}
          >
            {/* P-2: the state word pairs with its glyph, at every width. */}
            <CropFreeOutlined
              aria-hidden
              sx={{ fontSize: 14, color: 'text.secondary', flex: 'none' }}
            />
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary' }}>
              Demo · sample data
            </Typography>
            <BarSeparator />
            <Typography variant="caption" color="text.secondary" sx={PHONE_ONLY}>
              Oct 7, 2026
            </Typography>
            {/* From 600px up the bar names the product: a deep link to the desk or Research never
                shows the landing's explanation (spec 01, Why §1). The as-of is the owner's D2
                wording; "Signed in as the demo account" is gone, since the nav already shows the
                "Demo account" name from 600px up and the drawer shows it on a phone. */}
            <Typography variant="caption" color="text.secondary" sx={WIDE_ONLY}>
              Convexa is an options desk: dealer positioning, SEC filings and research notes.
            </Typography>
            <BarSeparator sx={WIDE_ONLY} />
            <Typography variant="caption" color="text.secondary" sx={WIDE_ONLY}>
              As of Oct 7, 2026 · no market feed connected
            </Typography>
            {/* Below 600px the playback line starts a line of its own (PhoneLineBreak), so it takes
                no separator there; from 600px up a separator precedes it. The row may wrap in these
                states at any width. */}
            {playback.playback === 'paused' && (
              <>
                <PhoneLineBreak />
                <BarSeparator sx={WIDE_ONLY} />
                <Typography variant="caption" color="text.secondary">
                  Simulated playback paused. Showing the last sample.
                </Typography>
                <Button size="small" onClick={resumeDemoPlayback} sx={{ minHeight: 44 }}>
                  Retry demo
                </Button>
              </>
            )}
            {playback.playback === 'ended' && (
              <>
                <PhoneLineBreak />
                <BarSeparator sx={WIDE_ONLY} />
                <Typography variant="caption" color="text.secondary">
                  Sample playback complete. Showing the last sample.
                </Typography>
              </>
            )}
            <ResetDemoControl onReset={resetDemoWorkspace} shortLabel="Reset" />
          </Box>
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
        {/* P-8: on the demo build every figure is the demo's sample, so a frame or chip that names no
            provenance of its own is dashed; the live build's stay solid. */}
        <WidgetProvenanceProvider value={dataMode === 'demo' ? 'sample' : 'primary'}>
          <Outlet />
        </WidgetProvenanceProvider>
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

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
import Box from '@mui/material/Box';
import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { CommandPalette } from './CommandPalette/CommandPalette';
import { TopNav } from './TopNav';

export function AppShell() {
  // (v2) The ⌘K palette — mounted ONCE in the shell so "one keystroke anywhere" holds on every
  // in-shell route (SPEC §2.6). NOT mounted on `/` — landing sits outside AppShell (canon rule 19
  // scopes the palette to the shell). Fires REGARDLESS of what currently holds focus — including a
  // text field (AC-33 requires the palette to open while a field holds unsaved text) — because
  // ⌘K/Ctrl-K is never a text-INSERTION key in any browser or OS; unlike a plain letter, it carries
  // no risk of "fighting" a form field, so no typing-target guard is needed (or correct: VS Code /
  // Linear / Notion all fire their palette shortcut from inside a focused field the same way).
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isOpenShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isOpenShortcut) {
        event.preventDefault();
        setPaletteOpen(true);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

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
      <TopNav onOpenPalette={() => setPaletteOpen(true)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
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
    </Box>
  );
}

export default AppShell;

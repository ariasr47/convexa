/**
 * AppShell — the persistent route LAYOUT for the in-shell pages (UX_BLUEPRINT §2, ARCHITECTURE §2). A
 * PARENT ROUTE rendering `<TopNav/>` + `<Outlet/>`, so the bar mounts once for the in-shell group and
 * does NOT remount across `/` ↔ Ticker ↔ Positions ↔ Scanner (AC-Nav-4) — the page content swaps in
 * the outlet, the bar persists.
 *
 * The bar itself is its own component, `TopNav` (the Figma "Top-nav bar"). AppShell owns no feature
 * data, makes no fetch, opens no SSE — a page-level error renders inside the outlet and never blanks
 * the bar (AC-Inv-2 page isolation).
 */
import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { TopNav } from './TopNav';

export function AppShell() {
  return (
    <Box data-testid="app-shell">
      <TopNav />
      {/* The active in-shell page renders here. The bar above persists across page swaps. */}
      <Outlet />
    </Box>
  );
}

export default AppShell;

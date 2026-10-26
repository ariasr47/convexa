/**
 * RouteFallback — the page-chunk loading fill: a page-shaped skeleton under the real nav, which
 * never blanks (design/src/screens/final/shell-site-docs.mjs, “Route loading”: a title bar, a lead
 * line and a body block, no centred spinner). It sits in the page column so the page arrives in
 * the same place, without a jump: it spreads the one page column, `pageColumnSx`.
 *
 * It asserts NOTHING about the session — its only words are `aria-label="Loading page"` — which is
 * exactly why `RequireAuth` may render it while the who-am-I read is in flight (SPEC §4). Moved
 * out of `app.tsx` so `RequireAuth` can import it without a cycle.
 */
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import { pageColumnSx } from './PageColumn';

/** Marks the fill on screen: the shell lays out no footer while one is showing (AppShell). */
export const ROUTE_FILL_SELECTOR = '[data-route-fill]';

/** Shown inside the shell's <Outlet/> region; the nav chrome stays interactive. */
export function RouteFallback() {
  return (
    <Box
      data-testid="route-fallback"
      data-route-fill=""
      role="progressbar"
      aria-label="Loading page"
      sx={{
        ...pageColumnSx,
        py: { xs: 3, md: 4 },
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        // A full screen, so the footer starts below the fold while the chunk arrives and nothing on
        // screen moves when the page replaces this fill. At 60vh the footer sat in the first screen
        // and the arriving page pushed it off: CLS 0.28-0.51 on a phone, ~0.21 on a laptop (site
        // audit 2026-10-25, PERF-02). The shell's sticky footer keeps a short page's footer down.
        minHeight: '100dvh',
      }}
    >
      <Skeleton variant="rounded" sx={{ height: 40, width: { xs: '70%', md: '40%' } }} />
      <Skeleton variant="rounded" sx={{ height: 16, width: { xs: '100%', md: '70%' } }} />
      <Skeleton variant="rounded" sx={{ height: { xs: 180, md: 220 }, mt: 1 }} />
    </Box>
  );
}

export default RouteFallback;

/**
 * RouteFallback — the page-chunk loading fill: a page-shaped skeleton under the real nav, which
 * never blanks (design/src/screens/final/shell-site-docs.mjs, “Route loading”: a title bar, a lead
 * line and a body block, no centred spinner). It sits in the page column so the page arrives in
 * the same place, without a jump.
 *
 * It asserts NOTHING about the session — its only words are `aria-label="Loading page"` — which is
 * exactly why `RequireAuth` may render it while the who-am-I read is in flight (SPEC §4). Moved
 * out of `app.tsx` so `RequireAuth` can import it without a cycle.
 */
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';

/** Shown inside the shell's <Outlet/> region; the nav chrome stays interactive. */
export function RouteFallback() {
  return (
    <Box
      data-testid="route-fallback"
      role="status"
      aria-label="Loading page"
      aria-busy="true"
      sx={{
        maxWidth: 1240,
        mx: 'auto',
        px: { xs: 2, md: 3 },
        py: { xs: 3, md: 4 },
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        // Tall enough that the footer doesn't flash up under the nav while the chunk arrives.
        minHeight: '60vh',
      }}
    >
      <Skeleton variant="rounded" sx={{ height: 40, width: { xs: '70%', md: '40%' } }} />
      <Skeleton variant="rounded" sx={{ height: 16, width: { xs: '100%', md: '70%' } }} />
      <Skeleton variant="rounded" sx={{ height: { xs: 180, md: 220 }, mt: 1 }} />
    </Box>
  );
}

export default RouteFallback;

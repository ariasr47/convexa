/**
 * RouteFallback — the minimal page-chunk loading fill. MOVED here from `app.tsx:99-108`
 * BYTE-IDENTICALLY (SPEC §2.2 item 6): same markup, same `data-testid`, same `aria-label`.
 * It was module-private in `app.tsx`, and `app.tsx` imports `RequireAuth` — so importing it back
 * would be an upward import AND a cycle. One file move, two import edits, zero render change.
 *
 * Its only string is `aria-label="Loading page"`, which asserts NOTHING about the session — which
 * is exactly why `RequireAuth` may render it while the who-am-I read is in flight (SPEC §4).
 */
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

/** Minimal page-chunk loading fill — theme tokens only (`[theme-token-discipline]`), centered,
 *  quiet. Shown inside the shell's <Outlet/> region; the nav chrome stays interactive. */
export function RouteFallback() {
  return (
    <Box
      data-testid="route-fallback"
      sx={{ display: 'flex', justifyContent: 'center', py: 8, color: 'text.secondary' }}
    >
      <CircularProgress size={24} color="inherit" aria-label="Loading page" />
    </Box>
  );
}

export default RouteFallback;

/**
 * `*` — the 404, INSIDE the shell group so the nav and the footer stay mounted (SPEC §2.5).
 * STATIC: no fetch, no SSE, no store, no session read. Tokens only — no hex.
 *
 * The headline is the page <h1>: it is an <h2> in the artboard only because it is nested under the
 * artboard's own <h1>, and shipping that verbatim gives a document whose outline starts at level 2 —
 * an accessibility-gate regression on a feature that requires zero waivers (SPEC §4).
 */
import { extrasFor } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { NOT_FOUND_COPY } from './copy';

export function NotFound() {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Nothing at this address — Convexa';
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <Box
      data-testid="not-found-page"
      sx={{ maxWidth: 640, mx: 'auto', px: 3, py: { xs: 6, md: 10 } }}
    >
      <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Typography
          variant="overline"
          component="p"
          sx={{ color: 'text.secondary', letterSpacing: '0.12em', m: 0 }}
        >
          {NOT_FOUND_COPY.code}
        </Typography>
        <Typography
          component="h1"
          variant="h4"
          sx={{ fontWeight: 700, letterSpacing: '-0.01em', m: 0 }}
        >
          {NOT_FOUND_COPY.headline}
        </Typography>
        <Typography component="p" variant="body1" sx={{ color: 'text.secondary', m: 0 }}>
          {NOT_FOUND_COPY.body}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1, width: '100%' }}>
          <Button
            component={RouterLink}
            to="/ticker"
            variant="contained"
            size="large"
            data-testid="not-found-primary"
            sx={{ minHeight: 44 }}
          >
            {NOT_FOUND_COPY.primary}
          </Button>
          <Button
            component={RouterLink}
            to="/"
            variant="outlined"
            size="large"
            data-testid="not-found-secondary"
            // GATE Z I-2 (AC-G1, color-contrast, serious): outlined-button labels default to
            // `primary.main` (measured 3.01:1 on `background.default` in light mode) — same
            // text-grade-amber fix as the landing's `cta-secondary` (F7c, `591e2654`).
            sx={{ minHeight: 44, color: (theme) => extrasFor(theme).textAmber }}
          >
            {NOT_FOUND_COPY.secondary}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export default NotFound;

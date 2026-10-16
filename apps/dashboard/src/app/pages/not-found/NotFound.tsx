/**
 * `*` — the 404, INSIDE the shell group so the nav and the footer stay mounted (SPEC §2.5).
 * STATIC: no fetch, no SSE, no store, no session read. Tokens only — no hex.
 *
 * The headline is the page <h1>: it is an <h2> in the artboard only because it is nested under the
 * artboard's own <h1>, and shipping that verbatim gives a document whose outline starts at level 2 —
 * an accessibility-gate regression on a feature that requires zero waivers (SPEC §4).
 */
import { typographyTokens } from '@/shared/theme/tokens';
import KeyboardCommandKeyOutlined from '@mui/icons-material/KeyboardCommandKeyOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { NOT_FOUND_COPY } from './copy';

function Kbd({ children }: { children: ReactNode }) {
  return (
    <Box
      component="kbd"
      sx={{
        px: 0.75,
        py: '1px',
        borderRadius: '4px',
        border: '1px solid',
        borderColor: 'divider',
        fontFamily: typographyTokens.monoFontFamily,
        fontSize: 12,
        color: 'text.primary',
        display: 'inline-flex',
        alignItems: 'center',
        verticalAlign: 'middle',
      }}
    >
      {children}
    </Box>
  );
}

/** ⌘K on a Mac, Ctrl K elsewhere (both open the jump-to box; so does /). The ⌘ is an icon: no
 *  bundled face carries U+2318 (TopNav.tsx, PR #46 §B). */
function paletteShortcut(): ReactNode {
  const platform =
    typeof navigator === 'undefined' ? '' : navigator.platform || navigator.userAgent;
  return /Mac|iPhone|iPad/i.test(platform) ? (
    <Box
      component="span"
      aria-label="Command K"
      sx={{ display: 'inline-flex', alignItems: 'center' }}
    >
      <KeyboardCommandKeyOutlined aria-hidden sx={{ fontSize: 12 }} />K
    </Box>
  ) : (
    'Ctrl K'
  );
}

export function NotFound() {
  const shortcut = paletteShortcut();
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
            // Neutral outlined secondary from the theme (owner ruling A, 2026-10-15): the amber
            // fill above is this page's one primary action.
            sx={{ minHeight: 44 }}
          >
            {NOT_FOUND_COPY.secondary}
          </Button>
          <Typography
            component="p"
            data-testid="not-found-palette-hint"
            sx={{
              m: 0,
              alignSelf: 'center',
              fontSize: 13.5,
              color: 'text.secondary',
              // The shortcut needs a keyboard: hidden on touch screens.
              '@media (hover: none) and (pointer: coarse)': { display: 'none' },
            }}
          >
            {NOT_FOUND_COPY.hintBefore} <Kbd>{shortcut}</Kbd> {NOT_FOUND_COPY.hintAfter}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}

export default NotFound;

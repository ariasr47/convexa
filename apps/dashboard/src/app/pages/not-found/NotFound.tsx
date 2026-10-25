/**
 * `*` — the 404, INSIDE the shell group so the nav and the footer stay mounted (SPEC §2.5).
 * STATIC: no fetch, no SSE, no store, no session read. Tokens only — no hex.
 *
 * The headline is the page <h1>: it is an <h2> in the artboard only because it is nested under the
 * artboard's own <h1>, and shipping that verbatim gives a document whose outline starts at level 2 —
 * an accessibility-gate regression on a feature that requires zero waivers (SPEC §4).
 *
 * As the Final board draws it (`design/src/screens/final/shell-site-docs.mjs` `notFoundBoard`;
 * fidelity COL, SITE-10): on the page column, left-aligned at the column's edge (x80 at 1440), 112px
 * under the nav, in a 640px measure (the board's 720px `.wrap` less its two 40px gutters). "404" in
 * mono 16px, the headline in display type at clamp(34px, 4vw, 52px), the lead 17/1.6 at 52ch.
 */
import { visuallyHidden } from '@/shared/a11y/visuallyHidden';
import { typographyTokens } from '@/shared/theme/tokens';
import { pageColumnSx } from '@/shared/ui/PageColumn';
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
 *  bundled face carries U+2318 (TopNav.tsx, PR #46 §B). The icon is hidden from screen readers and
 *  the word “Command” is spoken in its place: an aria-label on a role-less span is prohibited
 *  (axe aria-prohibited-attr) and was ignored, so VoiceOver read just “K”. */
function paletteShortcut(): ReactNode {
  const platform =
    typeof navigator === 'undefined' ? '' : navigator.platform || navigator.userAgent;
  return /Mac|iPhone|iPad/i.test(platform) ? (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
      <Box component="span" sx={visuallyHidden}>
        Command{' '}
      </Box>
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
    <Box data-testid="not-found-page" sx={pageColumnSx}>
      <Stack
        spacing={2.25}
        sx={{
          alignItems: 'flex-start',
          maxWidth: 640,
          pt: { xs: 6, md: 14 },
          pb: { xs: 6, md: 10 },
        }}
      >
        <Typography
          component="p"
          sx={{
            m: 0,
            fontFamily: typographyTokens.monoFontFamily,
            fontSize: 16,
            lineHeight: 1.5,
            color: 'text.secondary',
          }}
        >
          {NOT_FOUND_COPY.code}
        </Typography>
        <Typography
          component="h1"
          sx={{
            m: 0,
            fontFamily: typographyTokens.displayFontFamily,
            fontStretch: typographyTokens.displayFontStretch,
            fontWeight: 700,
            fontSize: 'clamp(34px, 4vw, 52px)',
            lineHeight: 1.1,
            letterSpacing: '-0.01em',
          }}
        >
          {NOT_FOUND_COPY.headline}
        </Typography>
        <Typography
          component="p"
          sx={{ m: 0, fontSize: 17, lineHeight: 1.6, maxWidth: '52ch', color: 'text.secondary' }}
        >
          {NOT_FOUND_COPY.body}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ width: '100%' }}>
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

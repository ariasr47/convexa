import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

/**
 * The one page column, the Final boards' `.wrap` (`design/src/lib.mjs:193`, `:208`): 1360px wide
 * with a `clamp(16px, 3vw, 40px)` gutter, so 1280px of content at x80 on a 1440 screen, and 1560px
 * (1480 of content) from the `wide` breakpoint (1600px, `theme.ts`). Border-box, so the gutter sits
 * inside the max width exactly as the board's does. Every page column, the nav and the production
 * bar spread this one object; no page sets its own max width (fidelity audit 2026-10-25, COL).
 */
export const pageColumnSx = {
  width: '100%',
  maxWidth: { xs: 1360, wide: 1560 },
  mx: 'auto',
  px: 'clamp(16px, 3vw, 40px)',
  boxSizing: 'border-box',
} as const;

/** The standard page column: `pageColumnSx` plus the page's vertical padding and safe-area bottom. */
export function PageColumn({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        ...pageColumnSx,
        minWidth: 0,
        py: { xs: 2, md: 4 },
        pb: 'max(2rem, env(safe-area-inset-bottom))',
      }}
    >
      {children}
    </Box>
  );
}

/**
 * The slim ops bar over the operator pages (/_ops/metrics, /_ops/research): off the trader shell,
 * unlinked. The wordmark, an "operator" tag, the path, the page's own facts as plain tags, and a line
 * saying what the page is. No colour carries a state here.
 *
 * Design: design/src/screens/final/shell-site-docs.mjs `opsBar`.
 */
import { typographyTokens } from '@/shared/theme/tokens';
import { ConvexaMark } from '@/shell/ConvexaMark';
import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

const MONO = typographyTokens.monoFontFamily;

/** A plain, neutral tag: a fact about the page, not a data state. 22 tall at a fine pointer and 24
 *  under a coarse one, as the board's `.stag` (design/src/lib.mjs; fidelity L13 outside item). It is
 *  text, not a control, so the 44px touch floor does not apply. */
export function OpsTag({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <Box
      component="span"
      data-testid={testId}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 22,
        '@media (pointer: coarse)': { minHeight: 24 },
        px: 1,
        borderRadius: '12px',
        border: 1,
        borderColor: 'divider',
        fontSize: 12,
        fontWeight: 500,
        color: 'text.primary',
      }}
    >
      {children}
    </Box>
  );
}

export function OpsBar({ path, children }: { path: string; children?: ReactNode }) {
  return (
    <Box
      component="header"
      data-testid="ops-bar"
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px 12px',
        minHeight: 52,
        px: { xs: 2, sm: 3 },
        py: 1,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <ConvexaMark fontSize={14} />
      <OpsTag>operator</OpsTag>
      <Box component="span" sx={{ fontFamily: MONO, fontSize: 12, color: 'text.secondary' }}>
        {path}
      </Box>
      {children}
      <Box sx={{ flex: 1 }} />
      <Box
        component="span"
        sx={{ display: { xs: 'none', md: 'inline' }, fontSize: 12, color: 'text.secondary' }}
      >
        Read-only · unlinked · off the trader shell
      </Box>
    </Box>
  );
}

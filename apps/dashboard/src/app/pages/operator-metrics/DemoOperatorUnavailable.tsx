/**
 * Both operator routes on the demo build: there is no API to read, so the page says so, says why,
 * and offers the way back. Sends no request.
 *
 * Design: design/src/screens/final/shell-site-docs.mjs `opsStagingBoard`: left-aligned on the page
 * column at x80 (1440), 680px of text, an Archivo 32/35.2 H1 (fidelity audit 2026-10-25, COL and
 * SITE-14).
 */
import { extrasFor, typographyTokens } from '@/shared/theme/tokens';
import { pageColumnSx } from '@/shared/ui/PageColumn';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { Link as RouterLink } from 'react-router-dom';

export function DemoOperatorUnavailable() {
  return (
    // 72px above and below at every width, as the board draws it (`padding: 72px 0`).
    <Box component="main" role="status" sx={{ ...pageColumnSx, py: 9 }}>
      <Box sx={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
        <Box
          component="span"
          sx={{
            fontFamily: typographyTokens.monoFontFamily,
            fontSize: 13,
            lineHeight: 1.5,
            color: 'text.secondary',
          }}
        >
          /_ops/metrics · /_ops/research
        </Box>
        <Box
          component="h1"
          sx={{
            m: 0,
            fontFamily: typographyTokens.displayFontFamily,
            fontStretch: typographyTokens.displayFontStretch,
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            lineHeight: 1.1,
            textWrap: 'balance',
          }}
        >
          Unavailable in the public demo.
        </Box>
        <Box component="p" sx={{ m: 0, fontSize: 15.5, lineHeight: 1.6, color: 'text.secondary' }}>
          Operator tools read a running API, and the demo has none: every screen runs in this
          browser on sample data.
        </Box>
        <Link
          component={RouterLink}
          to="/"
          underline="always"
          sx={{
            alignSelf: 'flex-start',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            minHeight: 44,
            fontWeight: 600,
            color: (t) => extrasFor(t).textInfo,
          }}
        >
          Back to the demo
          <ArrowForwardIcon sx={{ fontSize: 16 }} aria-hidden />
        </Link>
      </Box>
    </Box>
  );
}

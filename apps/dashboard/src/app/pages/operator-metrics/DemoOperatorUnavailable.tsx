/**
 * Both operator routes on the demo build: there is no API to read, so the page says so, says why,
 * and offers the way back. Sends no request.
 *
 * Design: design/src/screens/final/shell-site-docs.mjs `opsStagingBoard`.
 */
import { extrasFor, typographyTokens } from '@/shared/theme/tokens';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { Link as RouterLink } from 'react-router-dom';

export function DemoOperatorUnavailable() {
  return (
    <Box
      component="main"
      role="status"
      sx={{
        maxWidth: 760,
        mx: 'auto',
        px: { xs: 2, sm: 3 },
        py: { xs: 6, sm: 9 },
        display: 'flex',
        flexDirection: 'column',
        gap: 1.75,
      }}
    >
      <Box
        component="span"
        sx={{ fontFamily: typographyTokens.monoFontFamily, fontSize: 13, color: 'text.secondary' }}
      >
        /_ops/metrics · /_ops/research
      </Box>
      <Box component="h1" sx={{ m: 0, fontSize: { xs: 26, sm: 32 }, fontWeight: 700 }}>
        Unavailable in the public demo.
      </Box>
      <Box
        component="p"
        sx={{ m: 0, fontSize: 15.5, lineHeight: 1.6, color: 'text.secondary', maxWidth: '62ch' }}
      >
        Operator tools read a running API, and the demo has none: every screen runs in this browser
        on sample data.
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
  );
}

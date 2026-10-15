/**
 * Live builds only: a slim, persistent bar that says once, at the top, what is live on this site
 * (GET /api/health `market_data`, read once per load). Three forms:
 *
 * - `not_live` (no paid feed exists, canon P-1): “Options data isn’t live on this site.”, with
 *   “What’s live” (/methodology#data) and the staging demo.
 * - `paused` (a feed exists and an operator paused it): the paused copy, with research and the demo.
 * - `unknown` (/api/health failed or answered nothing we recognise): “Couldn’t check what’s live
 *   right now.” — the bar claims nothing either way, and each panel keeps its own tag.
 *
 * Nothing renders while the read is in flight or when the feed is live. It claims no liveness
 * (rule 18's connection chip is untouched).
 *
 * Design: design/src/lib.mjs v4Notice, design/src/screens/final/shell-site-front.mjs (unknownBar).
 */
import {
  marketDataOff,
  NOT_LIVE_COPY,
  PAUSED_COPY,
  UNKNOWN_COPY,
} from '@/shared/dataState/marketData';
import { useMarketDataMode } from '@/shared/hooks/useMarketDataMode';
import { STAGING_DEMO_URL } from '@/shared/lib/demoSite';
import { extrasFor } from '@/shared/theme/tokens';
import PauseCircleOutlineOutlined from '@mui/icons-material/PauseCircleOutlineOutlined';
import SensorsOffOutlined from '@mui/icons-material/SensorsOffOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';

const linkSx = {
  color: (theme: Parameters<typeof extrasFor>[0]) => extrasFor(theme).textInfo,
  minHeight: 24,
  display: 'inline-flex',
  alignItems: 'center',
  whiteSpace: 'nowrap',
} as const;

function WhatsLive() {
  return (
    <Link
      component={RouterLink}
      to="/methodology#data"
      variant="caption"
      underline="always"
      sx={linkSx}
      data-testid="market-data-notice-whats-live"
    >
      What’s live
    </Link>
  );
}

function DemoLink({ children }: { children: ReactNode }) {
  return (
    <Link
      href={STAGING_DEMO_URL}
      variant="caption"
      underline="always"
      // The phone bar keeps its title and “What’s live”; the demo link joins from 600px.
      sx={{ ...linkSx, display: { xs: 'none', sm: 'inline-flex' } }}
    >
      {children}
    </Link>
  );
}

export function MarketDataNotice() {
  const mode = useMarketDataMode();
  if (mode === null || mode === 'live') return null;

  const unknown = !marketDataOff(mode);
  const copy = unknown ? UNKNOWN_COPY : mode === 'not_live' ? NOT_LIVE_COPY : PAUSED_COPY;
  const Glyph = unknown
    ? WarningAmberOutlined
    : mode === 'not_live'
      ? SensorsOffOutlined
      : PauseCircleOutlineOutlined;

  return (
    <Box
      role="status"
      aria-label={unknown ? 'Market data status unknown' : 'What is live on this site'}
      data-testid="market-data-notice"
      data-mode={unknown ? 'unknown' : mode}
      sx={{
        px: { xs: 2, md: 3 },
        py: 1,
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Box
        sx={{
          maxWidth: 1240,
          mx: 'auto',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: 1.5,
          rowGap: 0.5,
        }}
      >
        <Glyph
          aria-hidden
          sx={{ fontSize: 14, color: unknown ? 'warning.main' : 'text.secondary', flex: 'none' }}
        />
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary' }}>
          {copy.title}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          // The not-live sentence names what is live; on a phone the title and “What’s live” say it.
          sx={{ display: mode === 'not_live' ? { xs: 'none', md: 'inline' } : 'inline' }}
        >
          {copy.body}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {mode === 'paused' ? (
            <>
              <Link
                component={RouterLink}
                to="/research"
                variant="caption"
                underline="always"
                sx={linkSx}
              >
                Read research
              </Link>
              <DemoLink>Try the full demo →</DemoLink>
            </>
          ) : (
            <>
              <WhatsLive />
              {!unknown && <DemoLink>See the full demo →</DemoLink>}
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}

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
 * While the read is in flight the bar's empty chrome holds its place (`NoticePlaceholder`, hidden
 * from assistive tech), so the page under it never moves when the answer lands; a live feed removes
 * it. It claims no liveness (rule 18's connection chip is untouched).
 *
 * Design: design/src/lib.mjs v4Notice, design/src/screens/final/shell-site-front.mjs (unknownBar).
 * The bar's row sits on the one page column (`pageColumnSx`), as the board's `.wrap` does, so its
 * glyph lines up with the nav's wordmark (fidelity audit 2026-10-25, COL).
 */
import {
  marketDataOff,
  NOT_LIVE_COPY,
  PAUSED_COPY,
  UNKNOWN_COPY,
} from '@/shared/dataState/marketData';
import { useMarketDataMode } from '@/shared/hooks/useMarketDataMode';
import { STAGING_DEMO_URL } from '@/shared/lib/demoSite';
import { pageColumnSx } from '@/shared/ui/PageColumn';
import { standaloneLinkSx } from '@/shared/ui/touch';
import PauseCircleOutlineOutlined from '@mui/icons-material/PauseCircleOutlineOutlined';
import SensorsOffOutlined from '@mui/icons-material/SensorsOffOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';

// A standalone link: 24px at a fine pointer, 44px under a coarse one, its text centred in the box
// (spec 2026-10-21/02, part (b)). It measured 58x24 on every production route at 390 before.
const linkSx = { ...standaloneLinkSx, whiteSpace: 'nowrap' } as const;

// Under a coarse pointer the 44px links fill the row, so the bar drops its 8px vertical padding
// there: 45px with its rule, not 61 (spec 2026-10-21/02, part (b)).
const barSx = {
  py: 1,
  '@media (pointer: coarse)': { py: 0 },
  bgcolor: 'background.paper',
  borderBottom: 1,
  borderColor: 'divider',
} as const;

const rowSx = {
  ...pageColumnSx,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: 1.5,
  rowGap: 0.5,
} as const;

// The not-live sentence names what is live; on a phone the title and “What’s live” say it.
const notLiveBodySx = { display: { xs: 'none', md: 'inline' } } as const;
// The phone bar keeps its title and “What’s live”; the demo link joins from 600px.
const demoLinkSx = { ...linkSx, display: { xs: 'none', sm: 'inline-flex' } } as const;

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
    <Link href={STAGING_DEMO_URL} variant="caption" underline="always" sx={demoLinkSx}>
      {children}
    </Link>
  );
}

/**
 * While /api/health is in flight: the not-live bar's chrome at its exact size (the same row, words
 * and link boxes, laid out and wrapped as the bar is at every width and pointer, but invisible and
 * hidden from assistive tech, with no links in it). Production answers `not_live`, so the bar fills
 * in where it stands. Before, the bar mounted on the answer and pushed every page down 41-45px
 * (site audit 2026-10-25, PERF-03: CLS 0.046 on the phone landing).
 */
function NoticePlaceholder() {
  return (
    <Box aria-hidden data-testid="market-data-notice-placeholder" sx={barSx}>
      <Box sx={{ ...rowSx, visibility: 'hidden' }}>
        <SensorsOffOutlined sx={{ fontSize: 14, flex: 'none' }} />
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          {NOT_LIVE_COPY.title}
        </Typography>
        <Typography variant="caption" sx={notLiveBodySx}>
          {NOT_LIVE_COPY.body}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="caption" sx={linkSx}>
            What’s live
          </Typography>
          <Typography variant="caption" sx={demoLinkSx}>
            See the full demo →
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export function MarketDataNotice() {
  const mode = useMarketDataMode();
  if (mode === null) return <NoticePlaceholder />;
  if (mode === 'live') return null;

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
      sx={barSx}
    >
      <Box sx={rowSx}>
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
          sx={mode === 'not_live' ? notLiveBodySx : { display: 'inline' }}
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

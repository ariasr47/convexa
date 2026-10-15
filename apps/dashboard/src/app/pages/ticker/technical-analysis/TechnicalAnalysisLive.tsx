/**
 * The Technical tab on the live site: TradingView's daily chart with the same indicators the demo
 * computes from sample bars (EMA 20 and 50, RSI 14), drawn by TradingView from prices it licenses.
 * Convexa has no daily-bar feed of its own whose terms allow public display
 * (docs/public-data/CANDIDATES.md, "Research, 2026-10-13"), so it shows TradingView's chart as
 * TradingView's, in the dotted third-party frame, and its own readings say Not live: they would be
 * computed from daily bars this site doesn't have, and never from TradingView's chart.
 *
 * Not embedded: TradingView's technical-rating gauge. It words its summary as buy and sell calls, and
 * Convexa presents signal-like readings as research, never as calls.
 *
 * Design: design/src/screens/final/ticker-tech.mjs (techProductionBody).
 */
import { formatShortDate } from '@/pages/research/format';
import { Caps } from '@/pages/research/publicUi';
import { DISPLAY, PANEL_SX } from '@/pages/research/ui';
import { TickerTabs } from '@/pages/ticker/TickerTabs';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { demoDeskUrl } from '@/shared/lib/demoSite';
import { extrasFor } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { researchIndex } from 'virtual:convexa-research';
import { TradingViewDaily } from './TradingViewDaily';

const linkSx = { color: (theme: Parameters<typeof extrasFor>[0]) => extrasFor(theme).textInfo };
const linkBox = { ...linkSx, display: 'inline-flex', alignItems: 'center', minHeight: 44 };

function Panel({
  label,
  title,
  tag,
  children,
}: {
  label: string;
  title: string;
  tag?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box
      component="section"
      aria-label={label}
      sx={{ ...PANEL_SX, p: '16px 18px', display: 'grid', gap: 1, alignContent: 'start' }}
    >
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px 10px',
        }}
      >
        <Box component="h3" sx={{ m: 0, fontSize: 15, fontWeight: 600 }}>
          {title}
        </Box>
        {tag}
      </Box>
      {children}
    </Box>
  );
}

function Line({ lead, children }: { lead?: string; children: ReactNode }) {
  return (
    <Box
      component="p"
      sx={{ m: 0, fontSize: 13, lineHeight: 1.5, color: 'text.secondary', textWrap: 'pretty' }}
    >
      {lead && (
        <Box component="strong" sx={{ color: 'text.primary', fontWeight: 600 }}>
          {`${lead} `}
        </Box>
      )}
      {children}
    </Box>
  );
}

export function TechnicalAnalysisLive({ symbol }: { symbol: string }) {
  const ticker = symbol.toUpperCase();
  const path = `/ticker/${encodeURIComponent(ticker)}`;
  const note = researchIndex.find((r) => r.ticker === ticker);
  const priceAsOf = note?.latest.aging.priceAsOf;

  return (
    <Box sx={{ display: 'grid', gap: 2.5, minWidth: 0 }}>
      <Box
        component="header"
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '12px 32px',
        }}
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 14px' }}>
          <Box
            component="h1"
            sx={{ ...DISPLAY, m: 0, fontWeight: 700, fontSize: { xs: 36, sm: 44 }, lineHeight: 1 }}
          >
            {ticker}
          </Box>
          {note?.latest.company && (
            <Box component="span" sx={{ fontSize: 14, color: 'text.secondary' }}>
              {note.latest.company}
            </Box>
          )}
        </Box>
        <TickerTabs ticker={ticker} current="technical" />
      </Box>

      <Box sx={{ display: 'grid', gap: 1 }}>
        <Caps>{`Technical analysis · ${ticker}`}</Caps>
        <Box
          component="p"
          sx={{ m: 0, maxWidth: '72ch', fontSize: 14, lineHeight: 1.55, color: 'text.secondary' }}
        >
          Exponential 20- and 50-day averages and RSI 14, drawn by TradingView from its own prices.
          They describe the trend; they are not calls to buy or sell.
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 8fr) minmax(0, 4fr)' },
          alignItems: 'start',
        }}
      >
        <TradingViewDaily ticker={ticker} height={620} headingLevel="h2" />
        <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <Panel
            label="Readings, not live"
            title="Readings Convexa computes"
            tag={<DataStateTag state="notLive" />}
          >
            <Line lead="Would show">
              EMA 20 and 50, RSI 14, ADX 14 and ATR 14 on the last daily bar, computed by Convexa
              and traceable to each bar.
            </Line>
            <Line lead="Off because">
              they need daily bars from the market-data feed, which this site doesn’t run. None of
              them is read from TradingView’s chart.
            </Line>
            <Link
              href={`${demoDeskUrl(ticker)}/technical-analysis`}
              variant="body2"
              underline="always"
              sx={{ ...linkBox, justifySelf: 'start', fontWeight: 500 }}
            >
              See them on the demo →
            </Link>
          </Panel>
          {note && (
            <Panel label="Research" title="Research note">
              <Line>
                {`The note values ${ticker} from its own dated price${priceAsOf ? ` (${formatShortDate(priceAsOf)})` : ''}, not from this chart.`}
              </Line>
              <Link
                component={RouterLink}
                to={`${path}/research`}
                variant="body2"
                underline="always"
                sx={{ ...linkBox, justifySelf: 'start', fontWeight: 500 }}
              >
                Read {ticker} research →
              </Link>
            </Panel>
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px' }}>
        <Link component={RouterLink} to={path} variant="body2" underline="always" sx={linkBox}>
          Back to the overview
        </Link>
      </Box>
      <Box component="p" sx={{ m: 0, fontSize: 12, color: 'text.secondary' }}>
        Research and tools, not investment advice.
      </Box>
    </Box>
  );
}

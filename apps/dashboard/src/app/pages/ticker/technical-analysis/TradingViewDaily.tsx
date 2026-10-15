/**
 * TradingView's daily chart for one ticker, as TradingView's: the same indicators the demo computes
 * from sample bars (EMA 20 and 50, RSI 14), drawn by TradingView from prices it licenses, with its own
 * attribution line and a plain note that TradingView receives the visitor's IP address. It loads on
 * view (canon P-14).
 *
 * The third-party frame (canon P-8, P-10): the frame is named, never claimed ("NVDA daily chart"), its
 * chip says whose chart it is, and the widget sits inside a dotted fence, the border that means "a
 * third party's". States:
 * - loading: "Loading TradingView's chart…" at the frame's final size until the loader's iframe is in;
 * - blocked or timed out: the script errored, or 12 s passed with no iframe. An info alert (nothing of
 *   Convexa's failed) links to TradingView; a new symbol starts over;
 * - unknown listing: a ticker outside the exchange map and without a note goes to TradingView bare, so
 *   if TradingView can't place it the empty chart is inside its frame, where Convexa can't see. A line
 *   under the frame says so.
 *
 * Used by the Technical tab (live build) and the public desk (live build, options feed off).
 * Design: design/src/components/charts.mjs thirdPartyFrame, screens/final/ticker-tech.mjs.
 */
import { ProvenanceChip } from '@/pages/research/publicUi';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { STAGING_DEMO_URL } from '@/shared/lib/demoSite';
import { extrasFor } from '@/shared/theme/tokens';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import { alpha, useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { researchIndex } from 'virtual:convexa-research';
import { tradingViewSymbol, tradingViewSymbolPath } from './tradingView';
import { TradingViewEmbed } from './TradingViewEmbed';

const linkSx = { color: (theme: Parameters<typeof extrasFor>[0]) => extrasFor(theme).textInfo };

/** How long the loader gets to put its iframe in before the frame says it didn't load. */
export const TRADINGVIEW_TIMEOUT_MS = 12_000;

export function TradingViewDaily({
  ticker,
  height,
  phoneHeight = 480,
  headingLevel = 'h3',
}: {
  ticker: string;
  height: number;
  phoneHeight?: number;
  headingLevel?: 'h2' | 'h3';
}) {
  const note = researchIndex.find((r) => r.ticker === ticker);
  const tv = tradingViewSymbol(ticker, note?.latest.about);
  // A bare symbol: neither the exchange map nor a note's listing placed it.
  const unknownListing = !tv.includes(':');
  const headId = `tv-${ticker}-head`;

  return (
    <Box
      component="section"
      aria-labelledby={headId}
      sx={{ display: 'grid', gap: 1.25, minWidth: 0 }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px' }}>
        <Box
          component={headingLevel}
          id={headId}
          sx={{ m: 0, fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}
        >
          {`${ticker} daily chart`}
        </Box>
        <ProvenanceChip text="Chart by TradingView · US prices delayed" kind="third-party" />
        <DataStateTag state="thirdParty" />
      </Box>
      <Box
        sx={(t) => ({
          p: 1,
          minWidth: 0,
          borderRadius: '14px',
          border: `1px dotted ${extrasFor(t).textTertiary}`,
          bgcolor: extrasFor(t).well,
        })}
      >
        {/* Keyed by the symbol: a new symbol starts over (loading, then ready or failed). */}
        <Frame key={tv} ticker={ticker} tv={tv} height={height} phoneHeight={phoneHeight} />
      </Box>
      {unknownListing && (
        <Box component="p" sx={{ m: 0, fontSize: 13, maxWidth: 640, textWrap: 'pretty' }}>
          {`Convexa couldn’t match ${ticker} to an exchange, so TradingView picks the listing. If the chart above is empty, TradingView doesn’t list it under that name. `}
          <Link
            href={`https://www.tradingview.com/symbols/${tradingViewSymbolPath(tv)}/`}
            target="_blank"
            rel="noopener noreferrer"
            underline="always"
            sx={linkSx}
          >
            {`Search ${ticker} on TradingView →`}
          </Link>
        </Box>
      )}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ maxWidth: 640, textWrap: 'pretty' }}
      >
        This chart loads from TradingView, which receives your IP address and this page’s address.
        Convexa doesn’t read, store or compute anything from the prices in it.
      </Typography>
    </Box>
  );
}

function Frame({
  ticker,
  tv,
  height,
  phoneHeight,
}: {
  ticker: string;
  tv: string;
  height: number;
  phoneHeight: number;
}) {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const [phase, setPhase] = useState<'loading' | 'ready' | 'failed'>('loading');
  const onFail = useCallback(() => setPhase('failed'), []);
  const onReady = useCallback(() => setPhase((p) => (p === 'loading' ? 'ready' : p)), []);
  // A loader that never errors and never draws (a stalled network, a blocker that swallows the
  // request) would leave the words up for good: after 12 s the frame says it didn't load.
  useEffect(() => {
    if (phase !== 'loading') return;
    const id = window.setTimeout(
      () => setPhase((p) => (p === 'loading' ? 'failed' : p)),
      TRADINGVIEW_TIMEOUT_MS,
    );
    return () => window.clearTimeout(id);
  }, [phase]);

  const config = useMemo(
    () => ({
      autosize: true,
      symbol: tv,
      interval: 'D',
      timezone: 'America/New_York',
      theme: theme.palette.mode,
      backgroundColor: theme.palette.background.paper,
      gridColor: alpha(theme.palette.text.secondary, 0.1),
      style: '1',
      locale: 'en',
      // No `range`: a preset range makes TradingView pick its own interval (6M opened on 2-hour
      // bars). `interval: 'D'` alone opens on daily bars, as the page says.
      withdateranges: true,
      hide_side_toolbar: true,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      details: false,
      hotlist: false,
      studies: [
        { id: 'MAExp@tv-basicstudies', inputs: { length: 20 } },
        { id: 'MAExp@tv-basicstudies', inputs: { length: 50 } },
        { id: 'RSI@tv-basicstudies', inputs: { length: 14 } },
      ],
      support_host: 'https://www.tradingview.com',
    }),
    [tv, theme],
  );

  if (phase === 'failed')
    return (
      <Alert severity="info" role="status">
        <AlertTitle>TradingView’s chart didn’t load.</AlertTitle>
        <Typography variant="body2">
          Its script was blocked or unreachable: a content blocker or the network can stop it.
          Nothing else on Convexa depends on it.
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mt: 1, rowGap: 0.5, flexWrap: 'wrap' }}>
          <Link
            href={`https://www.tradingview.com/symbols/${tradingViewSymbolPath(tv)}/`}
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
            underline="always"
            sx={linkSx}
          >
            Open {ticker} on TradingView →
          </Link>
          <Link href={STAGING_DEMO_URL} variant="body2" underline="always" sx={linkSx}>
            Try the full demo →
          </Link>
        </Stack>
      </Alert>
    );

  return (
    <Box sx={{ position: 'relative', minWidth: 0 }} aria-busy={phase === 'loading'}>
      <TradingViewEmbed
        widget="advanced-chart"
        config={config}
        attribution={{
          href: `https://www.tradingview.com/symbols/${tradingViewSymbolPath(tv)}/?utm_source=www.tradingview.com&utm_medium=widget_new&utm_campaign=advanced-chart`,
          label: `${ticker} stock chart`,
        }}
        height={phone ? phoneHeight : height}
        title={`${ticker} daily price chart with 20- and 50-day EMAs and RSI 14, by TradingView`}
        onFail={onFail}
        onReady={onReady}
      />
      {phase === 'loading' && (
        // Over the host, not in it: the loader owns the host's children.
        <Box
          role="status"
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '10px',
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            pointerEvents: 'none',
          }}
        >
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            Loading TradingView’s chart…
          </Typography>
        </Box>
      )}
    </Box>
  );
}

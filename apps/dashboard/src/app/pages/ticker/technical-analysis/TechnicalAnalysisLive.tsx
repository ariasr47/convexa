/**
 * The Technical tab on the live site: TradingView's daily chart with the same indicators the demo
 * computes from sample bars (EMA 20 and 50, RSI 14), drawn by TradingView from prices it licenses.
 * Convexa has no daily-bar feed of its own whose terms allow public display
 * (docs/public-data/CANDIDATES.md, "Research, 2026-10-13"), so it shows TradingView's chart as
 * TradingView's: a dotted third-party chip, TradingView's own attribution line, prices marked delayed,
 * and a plain note that TradingView receives the visitor's IP address.
 *
 * Not embedded: TradingView's technical-rating gauge. It words its summary as buy and sell calls, and
 * Convexa presents signal-like readings as research, never as calls.
 */
import { ProvenanceChip } from '@/pages/research/publicUi';
import { DISPLAY } from '@/pages/research/ui';
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
import { useCallback, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { researchIndex } from 'virtual:convexa-research';
import { tradingViewSymbol, tradingViewSymbolPath } from './tradingView';
import { TradingViewEmbed } from './TradingViewEmbed';

const linkSx = { color: (theme: Parameters<typeof extrasFor>[0]) => extrasFor(theme).textInfo };

export function TechnicalAnalysisLive({ symbol }: { symbol: string }) {
  const ticker = symbol.toUpperCase();
  const path = `/ticker/${encodeURIComponent(ticker)}`;
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const [failed, setFailed] = useState(false);
  const onFail = useCallback(() => setFailed(true), []);
  const note = researchIndex.find((r) => r.ticker === ticker);
  const tv = tradingViewSymbol(ticker, note?.latest.about);

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

  return (
    <Stack spacing={2.5} sx={{ minWidth: 0 }}>
      <Stack spacing={1}>
        <Typography component="h1" variant="overline" color="text.secondary">
          Technical analysis · {ticker}
        </Typography>
        <Box
          component="h2"
          sx={{ ...DISPLAY, m: 0, fontWeight: 600, fontSize: { xs: 22, sm: 26 } }}
        >
          {`${ticker} daily chart`}
        </Box>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ maxWidth: 640, textWrap: 'pretty' }}
        >
          Exponential 20- and 50-day averages and RSI 14, the readings the demo computes, drawn here
          by TradingView from its own prices. They describe the trend; they are not calls to buy or
          sell.
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <ProvenanceChip text="Chart by TradingView · US prices delayed" kind="third-party" />
        </Box>
      </Stack>

      {failed ? (
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
      ) : (
        <TradingViewEmbed
          widget="advanced-chart"
          config={config}
          attribution={{
            href: `https://www.tradingview.com/symbols/${tradingViewSymbolPath(tv)}/?utm_source=www.tradingview.com&utm_medium=widget_new&utm_campaign=advanced-chart`,
            label: `${ticker} stock chart`,
          }}
          height={phone ? 480 : 620}
          title={`${ticker} daily price chart with 20- and 50-day EMAs and RSI 14, by TradingView`}
          onFail={onFail}
        />
      )}

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ maxWidth: 640, textWrap: 'pretty' }}
      >
        This chart loads from TradingView, which receives your IP address and this page’s address.
        Convexa doesn’t read, store or compute anything from the prices in it.
      </Typography>

      <Stack direction="row" spacing={2} sx={{ rowGap: 0.5, flexWrap: 'wrap' }}>
        {note && (
          <Link
            component={RouterLink}
            to={`${path}/research`}
            variant="body2"
            underline="always"
            sx={linkSx}
          >
            Read {ticker} research →
          </Link>
        )}
        <Link component={RouterLink} to={path} variant="body2" underline="always" sx={linkSx}>
          Back to the overview
        </Link>
      </Stack>
    </Stack>
  );
}

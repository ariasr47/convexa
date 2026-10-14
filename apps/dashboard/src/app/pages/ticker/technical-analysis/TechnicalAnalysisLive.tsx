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
import { extrasFor } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { researchIndex } from 'virtual:convexa-research';
import { TradingViewDaily } from './TradingViewDaily';

const linkSx = { color: (theme: Parameters<typeof extrasFor>[0]) => extrasFor(theme).textInfo };

export function TechnicalAnalysisLive({ symbol }: { symbol: string }) {
  const ticker = symbol.toUpperCase();
  const path = `/ticker/${encodeURIComponent(ticker)}`;
  const note = researchIndex.find((r) => r.ticker === ticker);

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

      <TradingViewDaily ticker={ticker} height={620} />

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

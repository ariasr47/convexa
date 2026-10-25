/**
 * The Technical tab on the demo: Convexa's own chart from the scenario's 60 sample daily bars (close,
 * EMA 20, EMA 50, then RSI 14 in its own panel) in a dashed, hatched sample frame, and the five
 * readings (EMA 20, EMA 50, RSI 14, ADX 14, ATR 14) for the bar the chart's probe is on. No request
 * leaves the browser: the bars and the indicators come from the demo's scenario (libs/api demo).
 *
 * Design: design/src/screens/final/ticker-tech.mjs (techStagingBody, techStatesBody).
 */
import { Caps } from '@/pages/research/publicUi';
import { DISPLAY, MONO } from '@/pages/research/ui';
import { listingLine, TickerTabs } from '@/pages/ticker/TickerTabs';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { STAGING_DEMO_NAMES, STAGING_DEMO_SYMBOLS } from '@/shared/lib/demoSite';
import { extrasFor } from '@/shared/theme/tokens';
import {
  loadSampleBars,
  type IndicatorName,
  type IndicatorPoint,
  type LocalOutcome,
  type SampleBarsView,
} from '@convexa/api';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import { alpha } from '@mui/material/styles';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { researchIndex } from 'virtual:convexa-research';
import { SampleTaChart, shortDate } from './SampleTaChart';

const READINGS: { key: IndicatorName; label: string; sub: string; places: number }[] = [
  { key: 'ema20', label: 'EMA 20', sub: 'USD · daily close', places: 2 },
  { key: 'ema50', label: 'EMA 50', sub: 'USD · daily close', places: 2 },
  { key: 'rsi14', label: 'RSI 14', sub: 'Wilder · 0–100', places: 1 },
  { key: 'adx14', label: 'ADX 14', sub: 'Wilder · trend strength', places: 1 },
  { key: 'atr14', label: 'ATR 14', sub: 'USD · mean true range', places: 2 },
];

type ReadyState = {
  phase: 'ready';
  result: Extract<LocalOutcome<SampleBarsView>, { state: 'ready' }>;
  refreshing: boolean;
  refreshError?: string;
};
type RequestState =
  | { phase: 'loading' }
  | { phase: 'cold-error'; kind: 'unsupported' | 'error'; detail: string }
  | ReadyState;

const linkSx = { color: (theme: Parameters<typeof extrasFor>[0]) => extrasFor(theme).textInfo };
const linkBox = { ...linkSx, display: 'inline-flex', alignItems: 'center', minHeight: 44 };

function Masthead({ symbol }: { symbol: string }) {
  // "SPDR S&P 500 ETF · NYSE Arca": the demo's own name for the symbol, else a note's, then its
  // exchange (fidelity DESK-23, board `ticker-tech.mjs:64`).
  const note = researchIndex.find((r) => r.ticker === symbol);
  const listing = listingLine(
    symbol,
    STAGING_DEMO_NAMES[symbol] ?? note?.latest.company,
    note?.latest.about,
  );
  return (
    <>
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
            sx={{
              ...DISPLAY,
              m: 0,
              fontWeight: 700,
              fontSize: { xs: 36, sm: 44 },
              lineHeight: 1,
            }}
          >
            {symbol}
          </Box>
          {listing && (
            <Box component="span" sx={{ fontSize: 14, color: 'text.secondary' }}>
              {listing}
            </Box>
          )}
        </Box>
        <TickerTabs ticker={symbol} current="technical" />
      </Box>
      <Box sx={{ display: 'grid', gap: 1 }}>
        <Caps>{`Technical analysis · ${symbol}`}</Caps>
        <Box
          component="p"
          sx={{ m: 0, maxWidth: '72ch', fontSize: 14, lineHeight: 1.55, color: 'text.secondary' }}
        >
          Exponential 20- and 50-day averages, RSI 14, ADX 14 and ATR 14, computed from the demo’s
          60 sample daily bars. They describe the trend; they are not calls to buy or sell.
        </Box>
      </Box>
    </>
  );
}

/** A panel of sample data: dashed, with the hatch stripe along its top (canon P-3, P-8). */
function SamplePanel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box
      component="section"
      aria-label={label}
      sx={(t) => ({
        position: 'relative',
        display: 'grid',
        gap: 1.5,
        p: { xs: '16px 14px 14px', sm: '18px 20px 16px' },
        borderRadius: '12px',
        bgcolor: 'background.paper',
        border: `1px dashed ${extrasFor(t).textTertiary}`,
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 8,
          borderRadius: '11px 11px 0 0',
          pointerEvents: 'none',
          background: `repeating-linear-gradient(135deg, transparent 0 6px, ${alpha(
            t.palette.text.secondary,
            0.28,
          )} 6px 12px)`,
        },
      })}
    >
      {children}
    </Box>
  );
}

function Reading({
  label,
  sub,
  point,
  places,
}: {
  label: string;
  sub: string;
  point: IndicatorPoint;
  places: number;
}) {
  return (
    <Box
      sx={{ bgcolor: 'background.paper', p: '10px 12px', display: 'grid', gap: 0.5, minWidth: 0 }}
    >
      <Caps>{label}</Caps>
      {point.state === 'ready' ? (
        <>
          <Box component="span" sx={{ ...MONO, fontSize: 18, fontWeight: 500, lineHeight: 1.2 }}>
            {point.value.toFixed(places)}
          </Box>
          <Box component="span" sx={{ fontSize: 11, lineHeight: 1.35, color: 'text.secondary' }}>
            {sub}
          </Box>
        </>
      ) : (
        <>
          <Box component="span" sx={{ fontSize: 14, lineHeight: 1.3, color: 'text.secondary' }}>
            Insufficient history
          </Box>
          <Box component="span" sx={{ fontSize: 11, lineHeight: 1.35, color: 'text.secondary' }}>
            {`${point.observedBars} of ${point.requiredBars} bars`}
          </Box>
        </>
      )}
    </Box>
  );
}

export function TechnicalAnalysisView({ symbol }: { symbol: string }) {
  const ticker = symbol.toUpperCase();
  const [state, setState] = useState<RequestState>({ phase: 'loading' });
  const stateRef = useRef(state);
  const requestRef = useRef(0);
  const setCurrent = (next: RequestState) => {
    stateRef.current = next;
    setState(next);
  };
  const [selected, setSelected] = useState(59);
  const fetchBars = useCallback(
    async (retain: boolean) => {
      const requestId = ++requestRef.current;
      const previous = stateRef.current;
      if (retain && previous.phase === 'ready')
        setCurrent({ ...previous, refreshing: true, refreshError: undefined });
      else setCurrent({ phase: 'loading' });
      try {
        const result = await loadSampleBars(symbol);
        if (requestId !== requestRef.current) return;
        if (result.state === 'ready') setCurrent({ phase: 'ready', result, refreshing: false });
        else if (retain && previous.phase === 'ready')
          setCurrent({ ...previous, refreshing: false, refreshError: result.detail });
        else if (result.state === 'unsupported')
          setCurrent({ phase: 'cold-error', kind: 'unsupported', detail: result.detail });
        else setCurrent({ phase: 'cold-error', kind: 'error', detail: result.detail });
      } catch {
        if (requestId !== requestRef.current) return;
        if (retain && previous.phase === 'ready')
          setCurrent({
            ...previous,
            refreshing: false,
            refreshError: 'Sample data could not load.',
          });
        else
          setCurrent({
            phase: 'cold-error',
            kind: 'error',
            detail: 'The demo’s scenario file didn’t arrive.',
          });
      }
    },
    [symbol],
  );
  useEffect(() => {
    setSelected(59);
    void fetchBars(false);
  }, [fetchBars]);

  const path = `/ticker/${encodeURIComponent(ticker)}`;
  const links = (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px' }}>
      <Link
        component={RouterLink}
        to={`${path}/research`}
        variant="body2"
        underline="always"
        sx={linkBox}
      >
        Read {ticker} research →
      </Link>
      <Link component={RouterLink} to={path} variant="body2" underline="always" sx={linkBox}>
        Back to the overview
      </Link>
    </Box>
  );
  const foot = (
    <Box component="p" sx={{ m: 0, fontSize: 12, color: 'text.secondary' }}>
      Research and tools, not investment advice.
    </Box>
  );

  if (state.phase === 'loading')
    return (
      <Box sx={{ display: 'grid', gap: 2.5, minWidth: 0 }} aria-busy="true">
        <Masthead symbol={ticker} />
        <Skeleton variant="rounded" height={420} />
        <Skeleton variant="rounded" height={150} />
        <Box component="p" role="status" sx={{ m: 0, fontSize: 13, color: 'text.secondary' }}>
          Loading the sample bars…
        </Box>
      </Box>
    );
  if (state.phase === 'cold-error')
    return (
      <Box sx={{ display: 'grid', gap: 2.5, minWidth: 0 }}>
        <Masthead symbol={ticker} />
        {state.kind === 'unsupported' ? (
          <Box
            role="status"
            sx={{
              display: 'grid',
              gap: 0.5,
              p: 2,
              border: 1,
              borderColor: 'divider',
              borderRadius: '12px',
            }}
          >
            <Box component="strong" sx={{ fontSize: 14 }}>
              {`No sample data for ${ticker}.`}
            </Box>
            <Box component="span" sx={{ fontSize: 13, color: 'text.secondary' }}>
              {`The demo runs on ${STAGING_DEMO_SYMBOLS.slice(0, -1).join(', ')} and ${STAGING_DEMO_SYMBOLS.at(-1)}.`}
            </Box>
          </Box>
        ) : (
          <Alert
            severity="warning"
            action={
              <Button color="inherit" onClick={() => void fetchBars(false)} sx={{ minHeight: 44 }}>
                Retry demo
              </Button>
            }
          >
            <Box component="strong">The sample bars didn’t load.</Box> {state.detail}
          </Alert>
        )}
        {foot}
      </Box>
    );

  const view = state.result.value;
  const sel = Math.min(Math.max(selected, 0), view.bars.length - 1);
  const bar = view.bars[sel];
  const isLast = sel === view.bars.length - 1;
  return (
    <Box sx={{ display: 'grid', gap: 2.5, minWidth: 0 }}>
      <Masthead symbol={ticker} />
      {state.refreshError && (
        <Alert severity="warning">
          Couldn’t update the sample view. Showing the last sample. {state.refreshError}
        </Alert>
      )}
      <SampleTaChart symbol={ticker} view={view} selected={sel} onSelect={setSelected} />
      <SamplePanel label="Readings, sample">
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 10px' }}>
          <Box component="h2" sx={{ m: 0, flex: '1 1 auto', fontSize: 15, fontWeight: 600 }}>
            {isLast
              ? `Readings on the last bar · ${shortDate(bar.date)}`
              : `Readings on ${shortDate(bar.date)} · bar ${sel + 1} of ${view.bars.length}`}
          </Box>
          <DataStateTag state="sample" />
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(5, minmax(0, 1fr))',
            },
            gap: '1px',
            bgcolor: 'divider',
            border: 1,
            borderColor: 'divider',
            borderRadius: '10px',
            overflow: 'hidden',
            // Five readings in two columns: the last one takes the whole row, not half of it.
            '& > :last-child': { gridColumn: { xs: '1 / -1', md: 'auto' } },
          }}
        >
          {READINGS.map((r) => (
            <Reading
              key={r.key}
              label={r.label}
              sub={r.sub}
              places={r.places}
              point={view.indicators[r.key][sel]}
            />
          ))}
        </Box>
        <Box component="p" sx={{ m: 0, fontSize: 12, color: 'text.secondary', textWrap: 'pretty' }}>
          {`Computed in the browser from the ${view.bars.length} sample bars, each reading from the bar it names. A reading still warming up says “Insufficient history” and how many bars it has, never a zero.`}
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
          <Box
            component="span"
            sx={(t) => ({
              ...MONO,
              fontSize: 11,
              lineHeight: 1.35,
              px: 1.25,
              py: '4px',
              borderRadius: '12px',
              border: `1px dashed ${alpha(t.palette.text.secondary, 0.55)}`,
              color: 'text.secondary',
            })}
          >
            Sample · shaped like daily bars
          </Box>
          <Button
            onClick={() => void fetchBars(true)}
            disabled={state.refreshing}
            size="small"
            // Neutral text button from the theme (owner ruling A, 2026-10-15).
            sx={{ minHeight: 44 }}
          >
            {state.refreshing ? 'Refreshing…' : 'Refresh sample'}
          </Button>
        </Box>
      </SamplePanel>
      {links}
      {foot}
    </Box>
  );
}

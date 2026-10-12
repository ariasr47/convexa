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
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const INDICATORS: { key: IndicatorName; label: string }[] = [
  { key: 'ema20', label: 'EMA 20' },
  { key: 'ema50', label: 'EMA 50' },
  { key: 'rsi14', label: 'RSI 14' },
  { key: 'adx14', label: 'ADX 14' },
  { key: 'atr14', label: 'ATR 14' },
];
type ReadyState = {
  phase: 'ready';
  result: Extract<LocalOutcome<SampleBarsView>, { state: 'ready' }>;
  refreshing: boolean;
  refreshError?: string;
};
type RequestState =
  { phase: 'loading' } | { phase: 'cold-error'; detail: string; title: string } | ReadyState;

const number = (point: IndicatorPoint, unit: string) =>
  point.state === 'warmup' ? 'Unavailable' : `${point.value.toFixed(2)} ${unit}`;

export function TechnicalAnalysisView({ symbol }: { symbol: string }) {
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
          setCurrent({
            phase: 'cold-error',
            title: 'No sample data for this symbol.',
            detail: `No sample data for ${symbol}. Choose a supported symbol.`,
          });
        else if (result.state === 'unavailable')
          setCurrent({
            phase: 'cold-error',
            title: 'Analysis unavailable.',
            detail: 'Daily bars are not available from the live provider.',
          });
        else
          setCurrent({
            phase: 'cold-error',
            title: 'Sample data could not load.',
            detail: result.detail,
          });
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
            title: 'Sample data could not load.',
            detail: 'Sample data could not load.',
          });
      }
    },
    [symbol],
  );
  useEffect(() => {
    setSelected(59);
    void fetchBars(false);
  }, [fetchBars]);

  const view = state.phase === 'ready' ? state.result.value : undefined;
  const bar = view?.bars[selected];
  const series = useMemo<string>(() => {
    if (!view) return '';
    const values = view.bars.map((item) => item.close);
    const min = Math.min(...values),
      max = Math.max(...values),
      span = max - min || 1;
    return values
      .map(
        (value, index) =>
          `${index * (700 / Math.max(1, values.length - 1))},${180 - ((value - min) / span) * 150}`,
      )
      .join(' ');
  }, [view]);
  const indicatorPath = useCallback(
    (key: 'ema20' | 'ema50') => {
      if (!view) return '';
      const ready = view.indicators[key].flatMap((point, index) =>
        point.state === 'ready' ? [[index * (700 / 59), point.value] as const] : [],
      );
      if (ready.length < 2) return '';
      const closes = view.bars.map((item) => item.close);
      const min = Math.min(...closes),
        span = Math.max(...closes) - min || 1;
      return ready.map(([x, value]) => `${x},${180 - ((value - min) / span) * 150}`).join(' ');
    },
    [view],
  );

  if (state.phase === 'loading')
    return (
      <Stack spacing={2} aria-label="Loading sample data">
        <Typography component="h1" variant="overline" color="text.secondary">
          Technical analysis · {symbol}
        </Typography>
        <Skeleton variant="rounded" height={280} />
        <Skeleton variant="rounded" height={190} />
        <Typography role="status">Loading sample data…</Typography>
      </Stack>
    );
  if (state.phase === 'cold-error')
    return (
      <Alert
        severity="warning"
        action={
          <Button color="inherit" onClick={() => void fetchBars(false)}>
            Retry demo
          </Button>
        }
      >
        <Typography component="h1" variant="inherit" sx={{ display: 'inline', fontWeight: 700 }}>
          {state.title}
        </Typography>{' '}
        {state.detail}
      </Alert>
    );
  if (!view || !bar) return null;
  return (
    <Stack spacing={2.5} sx={{ minWidth: 0 }}>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <Typography component="h1" variant="overline" color="text.secondary">
          Technical analysis · {symbol}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          1d · USD · {view.bars.length} synthetic daily bars
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          component={Link}
          to={`/ticker/${encodeURIComponent(symbol)}`}
          size="small"
          sx={(theme) => ({ minHeight: 44, color: extrasFor(theme).textAmber })}
        >
          Overview
        </Button>
        <Button
          component={Link}
          to={`/ticker/${encodeURIComponent(symbol)}/research`}
          size="small"
          sx={(theme) => ({ minHeight: 44, color: extrasFor(theme).textAmber })}
        >
          Research
        </Button>
      </Box>
      {state.refreshError && (
        <Alert severity="warning">
          Couldn’t update the sample view. Showing the last sample. {state.refreshError}
        </Alert>
      )}
      <Card variant="outlined">
        <CardContent>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            sx={{ justifyContent: 'space-between', gap: 1 }}
          >
            <Typography component="h2" variant="subtitle1">
              Sample series · not recorded market history
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Daily close · USD · synthetic scenario
            </Typography>
          </Stack>
          <Box sx={{ mt: 1.5, width: '100%', overflow: 'hidden' }}>
            <svg
              viewBox="0 0 700 210"
              role="img"
              aria-label={`${symbol} synthetic daily closing prices across 60 authored sample bars`}
              style={{ display: 'block', width: '100%', height: 'auto' }}
            >
              <path
                d="M0 30H700M0 80H700M0 130H700M0 180H700"
                stroke="var(--mui-palette-divider)"
                strokeWidth="1"
              />
              <polyline
                points={indicatorPath('ema50')}
                fill="none"
                stroke="var(--mui-palette-info-main)"
                strokeWidth="2"
                strokeDasharray="6 4"
                strokeLinejoin="round"
              />
              <polyline
                points={indicatorPath('ema20')}
                fill="none"
                stroke="var(--mui-palette-primary-main)"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <polyline
                points={series}
                fill="none"
                stroke="var(--mui-palette-text-primary)"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle
                cx={selected * (700 / 59)}
                cy={
                  180 -
                  ((bar.close - Math.min(...view.bars.map((x) => x.close))) /
                    (Math.max(...view.bars.map((x) => x.close)) -
                      Math.min(...view.bars.map((x) => x.close)) || 1)) *
                    150
                }
                r="5"
                fill="var(--mui-palette-primary-main)"
              />
            </svg>
          </Box>
          <Typography variant="caption" component="p" color="text.secondary">
            Close ·{' '}
            <Box component="span" sx={(theme) => ({ color: extrasFor(theme).textAmber })}>
              EMA 20
            </Box>{' '}
            ·{' '}
            <Box component="span" sx={{ color: 'info.main' }}>
              EMA 50
            </Box>
          </Typography>
          <Box sx={{ px: 1, py: 1 }}>
            <Slider
              aria-label="Selected sample bar"
              min={0}
              max={view.bars.length - 1}
              step={1}
              value={selected}
              onChange={(_, value) => setSelected(value as number)}
              valueLabelDisplay="auto"
              valueLabelFormat={(index) => view.bars[index]?.date ?? ''}
              sx={{
                minHeight: 44,
                '& .MuiSlider-thumb': { width: 44, height: 44 },
                '& .MuiSlider-rail, & .MuiSlider-track': { height: 4 },
              }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Selected bar: {bar.date} · Open {bar.open.toFixed(2)} · High {bar.high.toFixed(2)} · Low{' '}
            {bar.low.toFixed(2)} · Close {bar.close.toFixed(2)} · Volume{' '}
            {bar.volume.toLocaleString()}
          </Typography>
        </CardContent>
      </Card>
      <Card variant="outlined">
        <CardContent>
          <Typography component="h2" variant="subtitle1" sx={{ mb: 1 }}>
            Indicator readings · {bar.date}
          </Typography>
          <Box
            component="table"
            sx={{
              borderCollapse: 'collapse',
              width: '100%',
              tableLayout: 'fixed',
              '& th,& td': {
                textAlign: 'left',
                p: { xs: 0.75, sm: 1 },
                borderBottom: 1,
                borderColor: 'divider',
                verticalAlign: 'top',
                overflowWrap: 'anywhere',
              },
              '& th': {
                color: 'text.secondary',
                fontSize: 11,
                letterSpacing: '.06em',
                textTransform: 'uppercase',
              },
              '& code': { overflowWrap: 'anywhere' },
            }}
          >
            <thead>
              <tr>
                <th>Reading</th>
                <th>Value</th>
                <th>Method · window · basis</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {INDICATORS.map(({ key, label }) => {
                const point = view.indicators[key][selected];
                return (
                  <tr key={key}>
                    <th scope="row">{label}</th>
                    <td>{number(point, point.state === 'ready' ? point.unit : '')}</td>
                    <td>
                      {point.state === 'warmup'
                        ? `Insufficient history · ${point.observedBars}/${point.requiredBars} bars`
                        : `${point.method} · ${point.window} bars · ${point.basis}`}
                    </td>
                    <td>
                      {point.state === 'warmup' ? (
                        'Not available yet'
                      ) : (
                        <code>{point.sourceBarId}</code>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Box>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
            Indicators are descriptive context, not a forecast or scored signal. Each value uses its
            stated method and source bar.
          </Typography>
        </CardContent>
      </Card>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Authored scenario · October 7, 2026 · no market feed connected
        </Typography>
        <Button
          onClick={() => void fetchBars(true)}
          disabled={state.refreshing}
          sx={(theme) => ({ minHeight: 44, color: extrasFor(theme).textAmber })}
        >
          {state.refreshing ? 'Refreshing…' : 'Refresh sample'}
        </Button>
      </Box>
    </Stack>
  );
}

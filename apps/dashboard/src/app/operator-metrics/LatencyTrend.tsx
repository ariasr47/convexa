/**
 * LatencyTrend — local, in-browser, ephemeral trend of the read-only /api/_metrics windowed
 * snapshots. Honest + non-alerting: gaps are broken lines (never 0/interpolated), restarts break
 * (never stitched), stale-repeats are visually distinct, headroom unknown is "unknown" (never a
 * number), no thresholds / red zones. Controls re-derive from stored polls — no extra network call.
 */
import {
  Card, CardContent, Stack, Typography, Chip, Button, Tooltip, Box,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DownloadIcon from '@mui/icons-material/Download';
import { useTheme } from '@mui/material/styles';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip as RTooltip,
} from 'recharts';
import { useLatencyTrend, STAGES, STAGE_COLORS, SINGLE_LINE_COLOR, TrendMetric, Percentile } from './useLatencyTrend';

type Trend = ReturnType<typeof useLatencyTrend>;

const fmtMs = (n: number | null | undefined) => (n == null ? '—' : n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${Math.round(n)}ms`);
const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const CAVEAT = 'Each point is the windowed percentile as of that time — not a per-request latency. Points overlap because the server\'s window slides; read it as a sequence of smoothed snapshots.';
const EPHEMERAL = 'Live, in-browser only — this trend clears when you reload or leave. That\'s expected; use Export to keep a run.';
const NON_ALERTING = 'Shown factually — no thresholds, no alerts. A high line or low headroom is information, not a warning.';
const TITLE_TIP = 'Polls the read-only /api/_metrics on your cadence and trends each windowed snapshot locally. Read-only and side-effect-free — it never triggers a fetch, recompute, or cache change.';
const HEADROOM_UNKNOWN = 'Vendor rate-limit headroom: unknown — the current vendor (Massive) doesn\'t report it. This chart populates for a vendor that does.';
const STALE_CAPTION = 'The window hasn\'t advanced, so these points repeat the last measurement — not steady latency.';

const METRIC_LABELS: Record<TrendMetric, string> = {
  stages: 'Stages (six lines)', total: 'Total latency', cache: 'Cache hit-ratio',
  vendor_latency: 'Vendor latency', headroom: 'Vendor headroom',
};
const lineColor = (key: string) => STAGE_COLORS[key] ?? SINGLE_LINE_COLOR;
const lineLabel = (metric: TrendMetric, key: string) =>
  metric === 'stages' ? key : metric === 'total' ? 'total latency' : metric === 'cache' ? 'hit-ratio' : metric === 'vendor_latency' ? 'vendor latency' : 'headroom';

function yFmt(metric: TrendMetric) {
  if (metric === 'cache') return (v: number) => `${Math.round(v)}%`;
  if (metric === 'headroom') return (v: number) => `${v}`;
  return (v: number) => fmtMs(v);
}

// Hollow grey dot for stale-repeat samples; solid colored dot otherwise.
function makeDot(color: string) {
  return (props: { cx?: number; cy?: number; payload?: { _tag?: string }; value?: number | null }) => {
    const { cx, cy, payload, value } = props;
    if (cx == null || cy == null || value == null) return <g />;
    const stale = payload?._tag === 'stale_repeat';
    return <circle cx={cx} cy={cy} r={2.6} fill={stale ? 'none' : color} stroke={stale ? '#9e9e9e' : color} strokeWidth={stale ? 1.2 : 0} />;
  };
}

export function LatencyTrend({ trend }: { trend: Trend }) {
  const theme = useTheme();
  const {
    data, error, metric, setMetric, percentile, setPercentile, scope, setScope,
    horizonMin, setHorizonMin, cadenceSec, setCadenceSec, paused, autoPaused, togglePause,
    hiddenStages, toggleStage, scopes, lineKeys, chartData, restartTimestamps,
    sampleCount, capped, latestTag, headroomUnknown, vendorMaxGap, tickerDropped, exportNow, lastExport,
  } = trend;

  const pctlHidden = metric === 'cache' || metric === 'headroom';
  const instrumentationOff = data != null && !data.instrumentation_enabled;
  const isStale = latestTag === 'stale_repeat';
  const horizonLabel = `${horizonMin}m`;

  // Centered placeholder text (gap, never blank/0) when there's nothing to plot.
  let placeholder: string | null = null;
  if (instrumentationOff) placeholder = 'No data — instrumentation is off.';
  else if (headroomUnknown) placeholder = HEADROOM_UNKNOWN;
  else if (vendorMaxGap) placeholder = 'vendor latency reports p50/p95 only';
  else if (sampleCount === 0) placeholder = 'No data yet — serve a bundle to start the trend.';

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mb: 0.5 }}>
          <Typography variant="subtitle1">Latency trend</Typography>
          <Tooltip arrow title={TITLE_TIP}><InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} /></Tooltip>
          <Box sx={{ flexGrow: 1 }} />
          <Chip size="small" color={paused || autoPaused ? 'default' : 'success'} variant={paused || autoPaused ? 'outlined' : 'filled'}
            label={paused ? 'paused' : autoPaused ? 'auto-paused' : `live ●`} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Last {horizonLabel} · {sampleCount} samples · in memory{capped ? ' · oldest drop at the cap' : ''}
          </Typography>
        </Stack>

        {/* Ephemerality — persistent, near the controls. */}
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>{EPHEMERAL}</Typography>

        {/* Controls. */}
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1, alignItems: 'center', mb: 1 }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Metric</InputLabel>
            <Select label="Metric" value={metric} onChange={(e) => setMetric(e.target.value as TrendMetric)}>
              {(Object.keys(METRIC_LABELS) as TrendMetric[]).map((m) => <MenuItem key={m} value={m}>{METRIC_LABELS[m]}</MenuItem>)}
            </Select>
          </FormControl>
          {!pctlHidden && (
            <FormControl size="small" sx={{ minWidth: 90 }}>
              <InputLabel>Pctl</InputLabel>
              <Select label="Pctl" value={percentile} onChange={(e) => setPercentile(e.target.value as Percentile)}>
                {(['p50', 'p95', 'max'] as Percentile[]).map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </Select>
            </FormControl>
          )}
          <FormControl size="small" sx={{ minWidth: 110 }}>
            <InputLabel>Scope</InputLabel>
            <Select label="Scope" value={scope} onChange={(e) => setScope(String(e.target.value))}>
              {scopes.map((s) => <MenuItem key={s} value={s}>{s === 'global' ? 'Global' : s}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 90 }}>
            <InputLabel>Horizon</InputLabel>
            <Select label="Horizon" value={horizonMin} onChange={(e) => setHorizonMin(Number(e.target.value))}>
              {[5, 15, 30].map((h) => <MenuItem key={h} value={h}>{h}m</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 90 }}>
            <InputLabel>Cadence</InputLabel>
            <Select label="Cadence" value={cadenceSec} onChange={(e) => setCadenceSec(Number(e.target.value))}>
              {[2, 5, 10, 30].map((c) => <MenuItem key={c} value={c}>{c}s</MenuItem>)}
            </Select>
          </FormControl>
          <Button size="small" startIcon={paused ? <PlayArrowIcon /> : <PauseIcon />} onClick={togglePause}>
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button size="small" startIcon={<DownloadIcon />} onClick={exportNow}>Export</Button>
        </Stack>

        {/* Stage legend chips (Metric = Stages) — click to hide a line. */}
        {metric === 'stages' && (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5, mb: 1 }}>
            {STAGES.map((s) => {
              const hidden = hiddenStages.has(s);
              return (
                <Chip key={s} size="small" variant="outlined" onClick={() => toggleStage(s)}
                  sx={{ opacity: hidden ? 0.4 : 1, textDecoration: hidden ? 'line-through' : 'none' }}
                  icon={<Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: STAGE_COLORS[s], ml: 1 }} />}
                  label={s} />
              );
            })}
          </Stack>
        )}

        {/* Transient state chips. */}
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 0.5, mb: 1, minHeight: 24, alignItems: 'center' }}>
          {error && <Chip size="small" color="warning" variant="outlined" label="Couldn't refresh — keeping the last trend, retrying on the next poll." />}
          {isStale && <Chip size="small" variant="outlined" label="No new traffic" />}
          {tickerDropped && <Chip size="small" variant="outlined" label={`No recent traffic for ${scope} — it left the window. The earlier line is kept.`} />}
          {(paused || autoPaused) && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{paused ? 'Paused — polling stopped; the trend is frozen. Resume to continue.' : 'Auto-paused while the tab was hidden.'}</Typography>}
          {lastExport != null && <Typography variant="caption" sx={{ color: 'success.main' }}>Exported the current trend ({lastExport} samples). Saved to your machine — no server state created.</Typography>}
        </Stack>
        {isStale && <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>{STALE_CAPTION}</Typography>}

        {/* Chart — keeps axes/grid even when empty (gap, never blank). */}
        <Box sx={{ position: 'relative' }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
              <XAxis dataKey="client_ts" type="number" scale="time" domain={['dataMin', 'dataMax']}
                tickFormatter={fmtTime} tick={{ fontSize: 11, fill: theme.palette.text.secondary }} stroke={theme.palette.text.secondary} />
              <YAxis tickFormatter={yFmt(metric)} width={52} tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                stroke={theme.palette.text.secondary} domain={['auto', 'auto']} />
              <RTooltip
                labelFormatter={(l) => fmtTime(Number(l))}
                formatter={(v, name) => [v == null ? '—' : yFmt(metric)(Number(v)), String(name)]}
                contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, fontSize: 12 }}
              />
              {restartTimestamps.map((ts, i) => (
                <ReferenceLine key={`rs-${i}`} x={ts} stroke={theme.palette.text.disabled} strokeDasharray="4 4"
                  label={{ value: 'Service restarted', position: 'top', fontSize: 10, fill: theme.palette.text.disabled }} />
              ))}
              {!headroomUnknown && lineKeys.map((k) => (
                <Line key={k} type="monotone" dataKey={k} name={lineLabel(metric, k)} stroke={lineColor(k)}
                  strokeWidth={1.6} connectNulls={false} isAnimationActive={false} dot={makeDot(lineColor(k))} activeDot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
          {placeholder && (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <Typography variant="body2" sx={{ color: 'text.disabled', maxWidth: 420, textAlign: 'center', bgcolor: 'background.paper', px: 1 }}>
                {placeholder}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Persistent caveat + non-alerting (under the chart, NOT tooltips). */}
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'flex-start', mt: 1 }}>
          <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled', mt: 0.25 }} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{CAVEAT} {NON_ALERTING}</Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

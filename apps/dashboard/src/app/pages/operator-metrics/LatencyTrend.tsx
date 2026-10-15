/**
 * LatencyTrend — local, in-browser, ephemeral trend of the read-only /api/_metrics windowed
 * snapshots. Honest + non-alerting: gaps are broken lines (never 0/interpolated), restarts break
 * (never stitched), stale-repeats are visually distinct, headroom unknown is "unknown" (never a
 * number), no thresholds / red zones. Controls re-derive from stored polls — no extra network call.
 *
 * On the v5 chart frame (canon P-8 to P-13): one ChartFrame whose title states a finding only over
 * data (P-10) and names the metric otherwise; neutral roles (P-9): one series is phosphor, two or
 * three step down through steel and chartContext2, and past three series (the six stages) the trend
 * splits into small multiples, one panel per stage on ONE shared scale, so no categorical hue is
 * needed. Text is 11px or more (P-13).
 *
 * Design: design/src/screens/final/shell-site-docs.mjs `opsReadyChart` / `opsMetricsBoard`.
 */
import {
  ChartFrame,
  chartRoles,
  type ChartStatus,
  type TableTwinData,
} from '@/shared/charts/frame';
import type { DataStateKey } from '@/shared/dataState/vocabulary';
import DownloadIcon from '@mui/icons-material/Download';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Percentile, STAGES, TrendMetric, useLatencyTrend } from './useLatencyTrend';

type Trend = ReturnType<typeof useLatencyTrend>;
type Row = Trend['chartData'][number];

const fmtMs = (n: number | null | undefined) =>
  n == null ? '—' : n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${Math.round(n)}ms`;
const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const CAVEAT =
  "Each point is the windowed percentile as of that time — not a per-request latency. Points overlap because the server's window slides; read it as a sequence of smoothed snapshots.";
const EPHEMERAL =
  "In-browser only — this trend clears when you reload or leave. That's expected; use Export to keep a run.";
const NON_ALERTING =
  'Shown factually — no thresholds, no alerts. A high line or low headroom is information, not a warning.';
const HEADROOM_UNKNOWN =
  "Vendor rate-limit headroom: unknown — the current vendor (Massive) doesn't report it. This chart populates for a vendor that does.";
const STALE_CAPTION =
  "The window hasn't advanced, so these points repeat the last measurement — not steady latency.";
/** Shipped copy (operator states board: "No requests yet"). */
const NO_REQUESTS = 'No requests recorded yet — serve a bundle to populate the baseline.';

const METRIC_LABELS: Record<TrendMetric, string> = {
  stages: 'Stages',
  total: 'Total latency',
  cache: 'Cache hit-ratio',
  vendor_latency: 'Vendor latency',
  headroom: 'Vendor headroom',
};
const lineLabel = (metric: TrendMetric, key: string) =>
  metric === 'stages'
    ? key
    : metric === 'total'
      ? 'total latency'
      : metric === 'cache'
        ? 'hit-ratio'
        : metric === 'vendor_latency'
          ? 'vendor latency'
          : 'headroom';

function yFmt(metric: TrendMetric) {
  if (metric === 'cache') return (v: number) => `${Math.round(v)}%`;
  if (metric === 'headroom') return (v: number) => `${v}`;
  return (v: number) => fmtMs(v);
}

/** Past this many series a trend splits into small multiples (P-9). */
const MAX_LINES = 3;

/** The latest finite value of `key`, or null. */
function latestOf(rows: Row[], key: string): number | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const v = rows[i][key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

/** P-10: the finding, stated only over data. */
function findingFor(metric: TrendMetric, pctl: Percentile, rows: Row[], keys: string[]): string {
  const f = yFmt(metric);
  if (metric === 'stages') {
    const latest = keys
      .map((k) => [k, latestOf(rows, k)] as const)
      .filter((e): e is readonly [string, number] => e[1] != null);
    if (latest.length === 0) return 'p95 latency by bundle stage';
    const [slow, v] = latest.reduce((a, b) => (b[1] > a[1] ? b : a));
    const total = latest.reduce((s, [, n]) => s + n, 0);
    return `${slow} is the slowest stage: ${pctl} ${f(v)} of ${f(total)} across the stages shown`;
  }
  const v = latestOf(rows, keys[0]);
  const name = METRIC_LABELS[metric];
  if (v == null) return name;
  return metric === 'cache'
    ? `Cache hit-ratio is ${f(v)} now`
    : metric === 'headroom'
      ? `Vendor headroom is ${f(v)} calls now`
      : `${name} ${pctl} is ${f(v)} now`;
}

// Hollow dot for stale-repeat samples; solid otherwise. Both in the series' own role colour.
function makeDot(color: string) {
  return (props: {
    cx?: number;
    cy?: number;
    payload?: { _tag?: string };
    value?: number | null;
  }) => {
    const { cx, cy, payload, value } = props;
    if (cx == null || cy == null || value == null) return <g />;
    const stale = payload?._tag === 'stale_repeat';
    return (
      <circle
        cx={cx}
        cy={cy}
        r={2.6}
        fill={stale ? 'none' : color}
        stroke={color}
        strokeWidth={stale ? 1.2 : 0}
      />
    );
  };
}

function TrendPlot({
  data,
  keys,
  colors,
  metric,
  height,
  yDomain,
  restartTimestamps,
  compact = false,
}: {
  data: Row[];
  keys: string[];
  colors: string[];
  metric: TrendMetric;
  height: number;
  yDomain: [number | 'auto', number | 'auto'];
  restartTimestamps: number[];
  compact?: boolean;
}) {
  const theme = useTheme();
  const roles = chartRoles(theme);
  const tick = { fontSize: 11, fill: theme.palette.text.secondary };
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 12, bottom: 2, left: 2 }}>
        <CartesianGrid vertical={false} stroke={roles.grid} />
        <XAxis
          dataKey="client_ts"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={fmtTime}
          tick={tick}
          stroke={roles.axis}
          tickCount={compact ? 2 : 5}
          minTickGap={compact ? 40 : 24}
        />
        <YAxis
          tickFormatter={yFmt(metric)}
          width={52}
          tick={tick}
          stroke={roles.axis}
          domain={yDomain}
          tickCount={compact ? 3 : 5}
        />
        <RTooltip
          labelFormatter={(l) => fmtTime(Number(l))}
          formatter={(v, name) => [v == null ? '—' : yFmt(metric)(Number(v)), String(name)]}
          contentStyle={{
            background: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            fontSize: 12,
          }}
        />
        {restartTimestamps.map((ts, i) => (
          <ReferenceLine
            key={`rs-${i}`}
            x={ts}
            stroke={roles.edge}
            strokeDasharray="4 4"
            label={
              compact
                ? undefined
                : { value: 'Service restarted', position: 'top', fontSize: 11, fill: roles.ctx }
            }
          />
        ))}
        {keys.map((k, i) => (
          <Line
            key={k}
            type="monotone"
            dataKey={k}
            name={lineLabel(metric, k)}
            stroke={colors[i]}
            strokeWidth={i === 0 ? 2 : 1.6}
            connectNulls={false}
            isAnimationActive={false}
            dot={makeDot(colors[i])}
            activeDot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function LatencyTrend({ trend }: { trend: Trend }) {
  const theme = useTheme();
  const roles = chartRoles(theme);
  const {
    data,
    error,
    metric,
    setMetric,
    percentile,
    setPercentile,
    scope,
    setScope,
    horizonMin,
    setHorizonMin,
    cadenceSec,
    setCadenceSec,
    paused,
    autoPaused,
    togglePause,
    hiddenStages,
    toggleStage,
    scopes,
    lineKeys,
    chartData,
    restartTimestamps,
    sampleCount,
    capped,
    latestTag,
    headroomUnknown,
    vendorMaxGap,
    tickerDropped,
    exportNow,
    lastExport,
  } = trend;

  const pctlHidden = metric === 'cache' || metric === 'headroom';
  const instrumentationOff = data != null && !data.instrumentation_enabled;
  const isStale = latestTag === 'stale_repeat';
  const pctl: Percentile = pctlHidden ? 'p95' : percentile;

  const hasValues = useMemo(
    () => lineKeys.some((k) => latestOf(chartData, k) != null),
    [chartData, lineKeys],
  );
  // One shared scale across every panel (P-9 small multiples): 0 to the largest value shown.
  const yMax = useMemo(() => {
    let m = 0;
    for (const r of chartData)
      for (const k of lineKeys) {
        const v = r[k];
        if (typeof v === 'number' && Number.isFinite(v) && v > m) m = v;
      }
    if (m <= 0) return 1;
    // A round ceiling (1, 2 or 5 × 10ⁿ above the largest value), so the shared axis reads cleanly.
    const p = 10 ** Math.floor(Math.log10(m));
    return [1, 2, 5, 10].map((k) => k * p).find((c) => c >= m * 1.05) ?? 10 * p;
  }, [chartData, lineKeys]);

  // Message states keep the frame and name the metric (P-10); a gap, never a blank or a 0.
  let status: ChartStatus = { kind: 'ready' };
  if (instrumentationOff)
    status = { kind: 'message', tone: 'quiet', text: 'No data — instrumentation is off.' };
  else if (headroomUnknown) status = { kind: 'message', tone: 'quiet', text: HEADROOM_UNKNOWN };
  else if (vendorMaxGap)
    status = { kind: 'message', tone: 'quiet', text: 'Vendor latency reports p50/p95 only.' };
  else if (!hasValues)
    status = {
      kind: 'message',
      tone: 'quiet',
      text: NO_REQUESTS,
      cause:
        sampleCount === 0
          ? undefined
          : 'Only the options bundle is timed here. A site with no options feed never runs it, so there is nothing to time.',
    };

  const multiples = metric === 'stages' && lineKeys.length > MAX_LINES;
  const lineColors = [roles.emph, roles.ctx, roles.ctx2];
  const unit = metric === 'cache' ? '%' : metric === 'headroom' ? 'calls' : 'ms';
  const sub = multiples
    ? `${pctl} latency by bundle stage, ${unit}, the last ${horizonMin} minutes · one panel per stage, shared scale (P-9)`
    : `${pctlHidden ? '' : `${pctl} `}${METRIC_LABELS[metric].toLowerCase()}, ${unit}, the last ${horizonMin} minutes${scope === 'global' ? '' : ` · ${scope}`}`;

  const tag: { state: DataStateKey; detail?: string } = instrumentationOff
    ? { state: 'off', detail: 'instrumentation' }
    : error
      ? { state: 'lastGood', detail: 'couldn’t refresh' }
      : paused || autoPaused
        ? { state: 'paused' }
        : { state: 'updated', detail: `polled every ${cadenceSec} s` };

  const table: TableTwinData | undefined = hasValues
    ? {
        caption: `${METRIC_LABELS[metric]} · the last ${Math.min(12, chartData.length)} polls`,
        cols: ['Time', ...lineKeys.map((k) => lineLabel(metric, k))],
        rows: chartData.slice(-12).map((r) => [
          fmtTime(r.client_ts),
          ...lineKeys.map((k) => {
            const v = r[k];
            return typeof v === 'number' && Number.isFinite(v) ? yFmt(metric)(v) : '—';
          }),
        ]),
      }
    : undefined;

  const legend =
    !multiples && lineKeys.length > 1 ? (
      <Box
        component="ul"
        sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}
      >
        {lineKeys.map((k, i) => (
          <Box
            component="li"
            key={k}
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 12 }}
          >
            <Box
              component="span"
              aria-hidden
              sx={{ width: 16, height: 2, bgcolor: lineColors[i], borderRadius: 1 }}
            />
            {lineLabel(metric, k)}
          </Box>
        ))}
      </Box>
    ) : undefined;

  return (
    <Stack spacing={1.5}>
      {/* Controls. They re-derive from stored polls; none fetches. */}
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Metric</InputLabel>
          <Select
            label="Metric"
            value={metric}
            onChange={(e) => setMetric(e.target.value as TrendMetric)}
          >
            {(Object.keys(METRIC_LABELS) as TrendMetric[]).map((m) => (
              <MenuItem key={m} value={m}>
                {METRIC_LABELS[m]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {!pctlHidden && (
          <FormControl size="small" sx={{ minWidth: 90 }}>
            <InputLabel>Pctl</InputLabel>
            <Select
              label="Pctl"
              value={percentile}
              onChange={(e) => setPercentile(e.target.value as Percentile)}
            >
              {(['p50', 'p95', 'max'] as Percentile[]).map((p) => (
                <MenuItem key={p} value={p}>
                  {p}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <FormControl size="small" sx={{ minWidth: 110 }}>
          <InputLabel>Scope</InputLabel>
          <Select label="Scope" value={scope} onChange={(e) => setScope(String(e.target.value))}>
            {scopes.map((s) => (
              <MenuItem key={s} value={s}>
                {s === 'global' ? 'Global' : s}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 90 }}>
          <InputLabel>Horizon</InputLabel>
          <Select
            label="Horizon"
            value={horizonMin}
            onChange={(e) => setHorizonMin(Number(e.target.value))}
          >
            {[5, 15, 30].map((h) => (
              <MenuItem key={h} value={h}>
                {h}m
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 90 }}>
          <InputLabel>Cadence</InputLabel>
          <Select
            label="Cadence"
            value={cadenceSec}
            onChange={(e) => setCadenceSec(Number(e.target.value))}
          >
            {[2, 5, 10, 30].map((c) => (
              <MenuItem key={c} value={c}>
                {c}s
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          size="small"
          startIcon={paused ? <PlayArrowIcon /> : <PauseIcon />}
          onClick={togglePause}
          sx={{ minHeight: 40 }}
        >
          {paused ? 'Resume' : 'Pause'}
        </Button>
        <Button
          size="small"
          startIcon={<DownloadIcon />}
          onClick={exportNow}
          sx={{ minHeight: 40 }}
        >
          Export
        </Button>
      </Stack>

      {/* Which stages to show (Metric = Stages). Neutral toggles: no stage owns a hue. */}
      {metric === 'stages' && (
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
          {STAGES.map((s) => {
            const hidden = hiddenStages.has(s);
            return (
              <Chip
                key={s}
                size="small"
                variant="outlined"
                onClick={() => toggleStage(s)}
                aria-pressed={!hidden}
                sx={{ opacity: hidden ? 0.5 : 1, textDecoration: hidden ? 'line-through' : 'none' }}
                label={s}
              />
            );
          })}
        </Stack>
      )}

      {/* Transient states, in words. */}
      {(error || isStale || tickerDropped || paused || autoPaused || lastExport != null) && (
        <Stack spacing={0.5}>
          {error && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 12 }}>
              Couldn’t refresh — keeping the last trend, retrying on the next poll.
            </Typography>
          )}
          {isStale && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 12 }}>
              No new traffic. {STALE_CAPTION}
            </Typography>
          )}
          {tickerDropped && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 12 }}>
              {`No recent traffic for ${scope} — it left the window. The earlier line is kept.`}
            </Typography>
          )}
          {(paused || autoPaused) && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 12 }}>
              {paused
                ? 'Paused — polling stopped; the trend is frozen. Resume to continue.'
                : 'Auto-paused while the tab was hidden.'}
            </Typography>
          )}
          {lastExport != null && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 12 }}>
              Exported the current trend ({lastExport} samples). Saved to your machine — no server
              state created.
            </Typography>
          )}
        </Stack>
      )}

      <ChartFrame
        testId="latency-trend"
        finding={findingFor(metric, pctl, chartData, lineKeys)}
        metric={multiples ? `${pctl} latency by bundle stage` : METRIC_LABELS[metric]}
        sub={sub}
        provenance="primary"
        status={status}
        tag={tag}
        height={multiples ? 300 : 260}
        legend={legend}
        note={`${CAVEAT} ${NON_ALERTING}`}
        source={{ text: 'This API process · /api/_metrics' }}
        asOf={`Last ${horizonMin}m · ${sampleCount} samples · in memory${capped ? ' · oldest drop at the cap' : ''}`}
        table={table}
        headingLevel="h2"
      >
        {multiples ? (
          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))',
            }}
          >
            {lineKeys.map((k) => (
              <Box
                key={k}
                role="group"
                aria-label={`${k}, ${pctl} latency, now ${fmtMs(latestOf(chartData, k))}`}
                sx={{ minWidth: 0 }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 1,
                    mb: 0.25,
                  }}
                >
                  <Box component="h3" sx={{ m: 0, fontSize: 12.5, fontWeight: 600 }}>
                    {k}
                  </Box>
                  <Box
                    component="span"
                    sx={{
                      fontFamily: '"IBM Plex Mono", monospace',
                      fontSize: 12,
                      color: 'text.secondary',
                    }}
                  >
                    {`${pctl} ${fmtMs(latestOf(chartData, k))}`}
                  </Box>
                </Box>
                <TrendPlot
                  data={chartData}
                  keys={[k]}
                  colors={[roles.emph]}
                  metric={metric}
                  height={120}
                  yDomain={[0, yMax]}
                  restartTimestamps={restartTimestamps}
                  compact
                />
              </Box>
            ))}
          </Box>
        ) : (
          <TrendPlot
            data={chartData}
            keys={lineKeys}
            colors={lineColors}
            metric={metric}
            height={260}
            yDomain={metric === 'cache' ? [0, 100] : [0, 'auto']}
            restartTimestamps={restartTimestamps}
          />
        )}
      </ChartFrame>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 12 }}>
        {EPHEMERAL}
      </Typography>
    </Stack>
  );
}

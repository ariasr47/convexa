/**
 * Operator metrics readout — a SEPARATE operator/developer surface (route `/_ops/metrics`), NOT
 * linked from the trader app. Read-only + side-effect-free: it GETs the metrics readout only and
 * never triggers a bundle fetch or any compute. Honest-presentation: no fabricated/zeroed number
 * as real (empty → `—`), `skipped` shown as skipped, low headroom is factual & non-alerting.
 */
import { useState } from 'react';
import {
  AppBar, Toolbar, Container, Box, Card, CardContent, Stack, Typography, Chip, Tooltip,
  Table, TableHead, TableBody, TableRow, TableCell, CircularProgress, Alert, Collapse, IconButton,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { MetricsScope, RecentTrace, StageName, StageKind } from '@org/api';
import { useLatencyTrend } from './operator-metrics/useLatencyTrend';
import { LatencyTrend } from './operator-metrics/LatencyTrend';

const fmtMs = (n: number | null | undefined) => (n == null ? '—' : n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${Math.round(n)}ms`);
const ioCpu = (kind: StageKind) => (kind.startsWith('io_') ? 'I/O' : 'CPU');
function fmtUptime(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60), h = Math.floor(m / 60);
  if (h >= 1) return `${h}h ${m % 60}m`;
  return `${m}m`;
}
const num = (n: number) => n.toLocaleString();

const STAGE_DOC: Record<StageName, string> = {
  vendor_fetch: 'Vendor REST: option chain + daily/intraday bars (+ recent trades when dark_pool on).',
  engine_build: 'GEX / greeks / walls / flip / DEX / Vol-OI / skew / term + HV + VWAP.',
  off_exchange: 'Off-exchange + block-prints pass; reports "skipped" when dark_pool is off.',
  signals: 'Setups / opportunity score + AI gate.',
  persist: 'Writes the per-ticker JSON files to disk.',
  serialize_wrap: 'Response envelope + tiering + position_eval + serialization.',
};
const IO_CPU_TIP = 'I/O = network/disk-bound (vendor_fetch, persist) → parallelizable/cacheable at fan-out. CPU = compute-bound (engine_build, off_exchange, signals, serialize_wrap) → needs worker/process parallelism. Hover the tag for the precise kind.';
const PCTL_TIP = 'Median (p50) and 95th-percentile (p95) latency over the current rolling window, plus count and max. p95 catches the slow tail a mean would hide.';
const CACHE_TIP = 'hit = served warm from the ~60s cache (near-zero compute); miss = full recompute; data age = how old the served snapshot is. Warm vs cold cost is never conflated.';
const HEADROOM_TIP = "The vendor's remaining calls vs its limit; the readout shows the MINIMUM observed this window (the tightest the run got). Best-effort — vendors that don't expose it show \"unknown\". Bounds how far a future multi-ticker scanner can fan out before throttling.";
const WINDOW_TIP = 'The aggregate is process-local and resets on restart — a live baseline tool, not a historical store. (Persisted baselines + OTel/Prometheus export are future-dated.)';
const TRACE_TIP = 'One id per served bundle, appearing in that request\'s structured logs, its verbose response meta.timings, and this recent-traces list — so a single request is traceable end-to-end. On a cache hit, a computed_trace_id points back to the miss-trace that produced the served bundle.';

function dimsLabel(d: RecentTrace['dims']): string {
  const dte = d.min_dte != null || d.max_dte != null ? `${d.min_dte ?? '–'}–${d.max_dte ?? '–'}d` : 'all';
  return [dte, d.expirations_present ? 'exp set' : null, d.dark_pool ? 'dark_pool' : null].filter(Boolean).join(' · ');
}

function ScopeView({ scope }: { scope: MetricsScope }) {
  const v = scope.vendor;
  const c = scope.cache;
  const ratioPct = Math.round((c.hit_ratio <= 1 ? c.hit_ratio * 100 : c.hit_ratio));
  return (
    <Box sx={{ mt: 1 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Stage</TableCell>
            <TableCell><Tooltip arrow title={IO_CPU_TIP}><span>kind</span></Tooltip></TableCell>
            <TableCell align="right"><Tooltip arrow title={PCTL_TIP}><span>p50</span></Tooltip></TableCell>
            <TableCell align="right">p95</TableCell>
            <TableCell align="right">max</TableCell>
            <TableCell align="right">count</TableCell>
            <TableCell align="right">ok/err/skip</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {scope.stages.map((s) => (
            <TableRow key={s.stage}>
              <TableCell>
                <Tooltip arrow title={STAGE_DOC[s.stage]}>
                  <span style={{ borderBottom: '1px dotted', cursor: 'help' }}>{s.stage}</span>
                </Tooltip>
              </TableCell>
              <TableCell><Tooltip arrow title={s.kind}><Chip size="small" variant="outlined" label={ioCpu(s.kind)} /></Tooltip></TableCell>
              <TableCell align="right">{s.count === 0 ? '—' : fmtMs(s.p50_ms)}</TableCell>
              <TableCell align="right">{s.count === 0 ? '—' : fmtMs(s.p95_ms)}</TableCell>
              <TableCell align="right">{s.count === 0 ? '—' : fmtMs(s.max_ms)}</TableCell>
              <TableCell align="right">{num(s.count)}</TableCell>
              <TableCell align="right">{num(s.ok)}/{num(s.error)}/{num(s.skipped)}</TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>TOTAL</TableCell>
            <TableCell />
            <TableCell align="right" sx={{ fontWeight: 600 }}>{scope.latency_total.count === 0 ? '—' : fmtMs(scope.latency_total.p50_ms)}</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>{scope.latency_total.count === 0 ? '—' : fmtMs(scope.latency_total.p95_ms)}</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>{scope.latency_total.count === 0 ? '—' : fmtMs(scope.latency_total.max_ms)}</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>{num(scope.latency_total.count)}</TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mt: 1, flexWrap: 'wrap' }}>
        <Tooltip arrow title={CACHE_TIP}><InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} /></Tooltip>
        <Typography variant="body2" color="text.secondary">
          Cache: hits {num(c.hits)} · misses {num(c.misses)} · hit ratio {ratioPct}% · current data age {Math.round(c.current_data_age_seconds)}s.
        </Typography>
      </Stack>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Tooltip arrow title={HEADROOM_TIP}><InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} /></Tooltip>
        <Typography variant="body2" color="text.secondary">
          Vendor: calls {num(v.call_count)} · latency p50 {fmtMs(v.latency_p50_ms)} / p95 {fmtMs(v.latency_p95_ms)} · min headroom{' '}
          {v.min_rate_limit_headroom == null ? (
            <Tooltip arrow title="this vendor doesn't report rate-limit headroom"><span>unknown</span></Tooltip>
          ) : (
            <>{num(v.min_rate_limit_headroom.remaining)} of {num(v.min_rate_limit_headroom.limit)} remaining (minimum observed this window) · bounds safe scanner fan-out.</>
          )}
        </Typography>
      </Stack>
    </Box>
  );
}

function TraceRow({ t }: { t: RecentTrace }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TableRow>
        <TableCell sx={{ fontFamily: 'monospace' }}>{t.trace_id.slice(0, 8)}…</TableCell>
        <TableCell>{t.ticker}</TableCell>
        <TableCell>{dimsLabel(t.dims)}</TableCell>
        <TableCell>{t.cache_hit ? `hit${t.computed_trace_id ? ` (↳${t.computed_trace_id.slice(0, 6)}…)` : ''}` : 'miss'}</TableCell>
        <TableCell align="right">{fmtMs(t.total_ms)}</TableCell>
        <TableCell align="right">
          <IconButton size="small" onClick={() => setOpen((o) => !o)}><ExpandMoreIcon fontSize="inherit" /></IconButton>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={6} sx={{ py: 0, border: 0 }}>
          <Collapse in={open}>
            <Box sx={{ py: 1, pl: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {t.cache_hit ? 'cache hit · near-zero compute' : 'cache miss · full compute'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                trace {t.trace_id} · {t.ticker} · {dimsLabel(t.dims)} · cache age {Math.round(t.cache_age_seconds)}s · total {fmtMs(t.total_ms)}
              </Typography>
              <Typography variant="caption" color="text.disabled">
                Per-stage timings + vendor calls for a single request travel in that request's verbose <code>meta.timings</code> (default-off), not in this rolling readout.
              </Typography>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export function OperatorMetrics() {
  // The latency-trend hook owns the page's SINGLE fetcher (one GET /api/_metrics per cadence). The
  // snapshot tables below render from its latest poll result (`data`) — no second fetch.
  const trend = useLatencyTrend();
  const { data, error, loading } = trend;
  const [openTickers, setOpenTickers] = useState<Record<string, boolean>>({});

  const header = (
    <AppBar position="static" elevation={0} color="default">
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>GammaFlow · Operator Metrics</Typography>
        {data && <Chip size="small" color={data.instrumentation_enabled ? 'success' : 'default'} label={`Instrumentation: ${data.instrumentation_enabled ? 'ON' : 'OFF'}`} sx={{ mr: 1 }} />}
        <Chip size="small" variant="outlined" label="read-only" sx={{ mr: 1 }} />
      </Toolbar>
    </AppBar>
  );

  let body: React.ReactNode;
  if (loading && !data) {
    body = <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><CircularProgress size={18} /><Typography variant="body2">Loading metrics…</Typography></Stack>;
  } else if (error && !data) {
    // Cold-load failure only (no prior poll). A failed poll AFTER a success keeps `data` and the
    // trend shows its own soft "couldn't refresh" — the page does not blank.
    body = (
      <Alert severity="warning">
        Metrics readout unavailable.
        <Typography variant="caption" sx={{ display: 'block' }}>Operator tool only — the trader bundle and SSE are unaffected.</Typography>
      </Alert>
    );
  } else if (data) {
    const empty = data.window.request_count === 0;
    body = (
      <Stack spacing={2}>
        {/* Latency trend — first child; its poll loop is the page's single fetcher. */}
        <LatencyTrend trend={trend} />

        {!data.instrumentation_enabled ? (
          <Alert severity="info">
            Instrumentation disabled — no metrics are being recorded. Enable it via the observability flag to populate this readout.
          </Alert>
        ) : (
        <>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Tooltip arrow title={WINDOW_TIP}><InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} /></Tooltip>
          <Typography variant="body2" color="text.secondary">
            Rolling window: last {data.window.size_desc} · uptime {fmtUptime(data.window.uptime_seconds)} · resets on restart (ephemeral baseline).
          </Typography>
        </Stack>

        {empty ? (
          <Alert severity="info">No requests recorded yet — serve a bundle to populate the baseline.</Alert>
        ) : (
          <>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1">Global roll-up <Typography component="span" variant="caption" color="text.secondary">· requests: {num(data.window.request_count)}</Typography></Typography>
                <ScopeView scope={data.global} />
              </CardContent>
            </Card>

            <Box>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>Per-ticker</Typography>
              <Stack spacing={1}>
                {Object.entries(data.per_ticker).map(([tk, scope]) => (
                  <Card key={tk} variant="outlined">
                    <CardContent sx={{ '&:last-child': { pb: 1 } }}>
                      <Stack direction="row" sx={{ alignItems: 'center' }}>
                        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>{tk} <Typography component="span" variant="caption" color="text.secondary">({num(scope.latency_total.count)})</Typography></Typography>
                        <IconButton size="small" onClick={() => setOpenTickers((p) => ({ ...p, [tk]: !p[tk] }))}><ExpandMoreIcon fontSize="inherit" /></IconButton>
                      </Stack>
                      <Collapse in={!!openTickers[tk]}><ScopeView scope={scope} /></Collapse>
                    </CardContent>
                  </Card>
                ))}
                {Object.keys(data.per_ticker).length === 0 && <Typography variant="body2" color="text.disabled">—</Typography>}
              </Stack>
            </Box>

            {data.recent_traces && data.recent_traces.length > 0 && (
              <Card variant="outlined">
                <CardContent>
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle1">Recent traces</Typography>
                    <Tooltip arrow title={TRACE_TIP}><InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} /></Tooltip>
                  </Stack>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>trace_id</TableCell><TableCell>ticker</TableCell><TableCell>dims</TableCell>
                        <TableCell>cache</TableCell><TableCell align="right">total</TableCell><TableCell align="right">inspect</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.recent_traces.map((t) => <TraceRow key={t.trace_id} t={t} />)}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}
        </>
        )}
      </Stack>
    );
  }

  return (
    <>
      {header}
      <Container maxWidth="lg" sx={{ py: 3 }}>{body}</Container>
    </>
  );
}

export default OperatorMetrics;

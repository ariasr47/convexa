/**
 * useLatencyTrend — the latency visualizer brain. Owns the operator page's SINGLE fetcher: a paused-
 * able poll loop that issues ONLY `GET /api/_metrics` once per cadence, and a bounded, ephemeral,
 * serializable ring buffer of per-scope snapshots. Switching metric / percentile / stage re-derives
 * from the stored snapshots — NO control ever triggers a fetch, recompute, cache mutation, or any
 * trader-route call. Series clears on unmount/reload (ephemeral, expected); the only save is Export.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchMetrics, MetricsAggregate, MetricsScope } from '@org/api';

export type TrendMetric = 'stages' | 'total' | 'cache' | 'vendor_latency' | 'headroom';
export type Percentile = 'p50' | 'p95' | 'max';
export type SampleTag = 'live' | 'cold' | 'stale_repeat' | 'restart' | 'headroom_unknown';

export const STAGES = ['vendor_fetch', 'engine_build', 'off_exchange', 'signals', 'persist', 'serialize_wrap'] as const;
// Categorical, NON-semantic, colorblind-distinguishable palette (no red-for-bad/green-for-good).
export const STAGE_COLORS: Record<string, string> = {
  vendor_fetch: '#4e79a7', engine_build: '#f28e2b', off_exchange: '#59a14f',
  signals: '#b07aa1', persist: '#76b7b2', serialize_wrap: '#edc949',
};
export const SINGLE_LINE_COLOR = '#4e79a7';

const COUNT_CAP = 1000;        // hard memory guarantee (bounded regardless of cadence)
const AGE_MAX_MS = 30 * 60_000; // 30m max retained; horizon controls the visible window

/** One stored poll snapshot for a scope. Raw `scopeData` is kept so metric/percentile/stage switches
 *  re-derive without refetching. `restart`/null scopeData ⇒ a break (gap), never stitched. */
export interface StoredSample {
  client_ts: number;
  scope: string;
  scopeData: MetricsScope | null; // null ⇒ no-data break (restart boundary / dropped ticker)
  instrumentation_enabled: boolean;
  request_count: number;
  uptime_seconds: number;
  tag: SampleTag;
  restart?: boolean;
}

const PCTL: Record<Percentile, 'p50_ms' | 'p95_ms' | 'max_ms'> = { p50: 'p50_ms', p95: 'p95_ms', max: 'max_ms' };

export function useLatencyTrend() {
  const [data, setData] = useState<MetricsAggregate | null>(null);
  const [error, setError] = useState(false);   // last poll failed (soft; series kept)
  const [loading, setLoading] = useState(true); // initial, no data yet

  // Controls.
  const [metric, setMetric] = useState<TrendMetric>('stages');
  const [percentile, setPercentile] = useState<Percentile>('p95');
  const [scope, setScope] = useState('global');
  const [horizonMin, setHorizonMin] = useState(15);
  const [cadenceSec, setCadenceSec] = useState(5);
  const [paused, setPaused] = useState(false);
  const [autoPaused, setAutoPaused] = useState(false);
  const [hiddenStages, setHiddenStages] = useState<Set<string>>(new Set());
  const [lastExport, setLastExport] = useState<number | null>(null);

  // Ephemeral ring buffer: scopeKey -> samples. Bump `version` to re-render on append.
  const seriesRef = useRef<Map<string, StoredSample[]>>(new Map());
  const seenScopesRef = useRef<Set<string>>(new Set(['global']));
  const prevMarkers = useRef<{ req: number; up: number } | null>(null);
  const [version, setVersion] = useState(0);

  const append = useCallback((key: string, s: StoredSample) => {
    const arr = seriesRef.current.get(key) ?? [];
    arr.push(s);
    const cutoff = Date.now() - AGE_MAX_MS;
    let pruned = arr.filter((x) => x.client_ts >= cutoff);
    if (pruned.length > COUNT_CAP) pruned = pruned.slice(pruned.length - COUNT_CAP);
    seriesRef.current.set(key, pruned);
  }, []);

  // One poll = the page's only network call.
  const poll = useCallback(async () => {
    let agg: MetricsAggregate;
    try {
      agg = await fetchMetrics();
    } catch {
      setError(true); setLoading(false); // keep prior series + data; self-heal next interval
      return;
    }
    setError(false); setData(agg); setLoading(false);

    const now = Date.now();
    const req = agg.window.request_count, up = agg.window.uptime_seconds;
    const prev = prevMarkers.current;
    const restart = !!prev && (req < prev.req || up < prev.up);
    const stale = !!prev && !restart && req === prev.req && agg.instrumentation_enabled;
    const baseTag: SampleTag = !agg.instrumentation_enabled ? 'cold' : restart ? 'restart' : stale ? 'stale_repeat' : 'live';
    prevMarkers.current = { req, up };

    // Restart: insert a null break sample at the boundary so the line never stitches.
    if (restart) {
      for (const key of seenScopesRef.current) {
        append(key, { client_ts: now - 1, scope: key, scopeData: null, instrumentation_enabled: agg.instrumentation_enabled, request_count: req, uptime_seconds: up, tag: 'restart', restart: true });
      }
    }

    const scopes: Array<[string, MetricsScope]> = [['global', agg.global], ...Object.entries(agg.per_ticker)];
    const present = new Set(scopes.map(([k]) => k));
    for (const [key, sc] of scopes) {
      seenScopesRef.current.add(key);
      append(key, { client_ts: now, scope: key, scopeData: sc, instrumentation_enabled: agg.instrumentation_enabled, request_count: req, uptime_seconds: up, tag: baseTag });
    }
    // Selected ticker dropped from the window → a no-data break for its line (kept history).
    if (scope !== 'global' && !present.has(scope) && seenScopesRef.current.has(scope)) {
      append(scope, { client_ts: now, scope, scopeData: null, instrumentation_enabled: agg.instrumentation_enabled, request_count: req, uptime_seconds: up, tag: 'cold' });
    }
    setVersion((v) => v + 1);
  }, [append, scope]);

  // Poll loop = the page's ONLY fetcher. One stable interval, recreated solely when the cadence
  // changes. Pause/visibility are read from a ref at fire time (the interval is never torn down by
  // them), so churn — StrictMode double-invoke, visibility flapping — can never add a second interval
  // or burst. Exactly one fetch per cadence; pause/hidden simply skip the tick (no network).
  const pollRef = useRef(poll);
  useEffect(() => { pollRef.current = poll; }, [poll]);
  const gateRef = useRef({ paused, autoPaused });
  useEffect(() => { gateRef.current = { paused, autoPaused }; }, [paused, autoPaused]);
  useEffect(() => {
    let active = true;
    const tick = () => { if (active && !gateRef.current.paused && !gateRef.current.autoPaused) void pollRef.current(); };
    tick(); // immediate first poll for this cadence
    const id = setInterval(tick, cadenceSec * 1000);
    return () => { active = false; clearInterval(id); };
  }, [cadenceSec]);

  // Auto-pause when the tab is hidden (recommended); resumes when visible.
  useEffect(() => {
    const onVis = () => setAutoPaused(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    setAutoPaused(document.hidden);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const togglePause = useCallback(() => setPaused((p) => !p), []);
  const toggleStage = useCallback((st: string) => setHiddenStages((prev) => {
    const next = new Set(prev); if (next.has(st)) next.delete(st); else next.add(st); return next;
  }), []);

  // Available scopes = global + tickers present in the latest poll (absent ticker not selectable).
  const scopes = useMemo(() => ['global', ...Object.keys(data?.per_ticker ?? {})], [data]);
  // If the active scope vanished, the chart shows the kept line + a "dropped" chip (handled in UI).

  const activeSamples = useMemo(
    () => seriesRef.current.get(scope) ?? [],
    [scope, version],
  );

  // ---- Derive chart lines from stored snapshots (no refetch on any switch) -------------------
  const lineKeys = useMemo<string[]>(() => {
    if (metric === 'stages') return STAGES.filter((s) => !hiddenStages.has(s));
    if (metric === 'total') return ['total'];
    if (metric === 'cache') return ['hit_ratio'];
    if (metric === 'vendor_latency') return ['vendor'];
    return ['headroom'];
  }, [metric, hiddenStages]);

  const deriveValue = useCallback((sc: MetricsScope | null, key: string): number | null => {
    if (!sc) return null;
    const f = PCTL[percentile];
    if (metric === 'stages') {
      const st = sc.stages.find((x) => x.stage === key);
      return st && st.count > 0 ? st[f] : null;
    }
    if (metric === 'total') return sc.latency_total.count > 0 ? sc.latency_total[f] : null;
    if (metric === 'cache') { const r = sc.cache.hit_ratio; return r == null ? null : r <= 1 ? r * 100 : r; }
    if (metric === 'vendor_latency') {
      if (percentile === 'max') return null; // vendor latency reports p50/p95 only
      return percentile === 'p50' ? sc.vendor.latency_p50_ms : sc.vendor.latency_p95_ms;
    }
    return sc.vendor.min_rate_limit_headroom?.remaining ?? null; // headroom; null ⇒ unknown gap
  }, [metric, percentile]);

  const horizonMs = horizonMin * 60_000;
  const chartData = useMemo(() => {
    const cutoff = Date.now() - horizonMs;
    return activeSamples
      .filter((s) => s.client_ts >= cutoff)
      .map((s) => {
        const row: { client_ts: number; _tag: SampleTag; _restart?: boolean; [k: string]: number | string | boolean | null | undefined } =
          { client_ts: s.client_ts, _tag: s.tag, _restart: s.restart };
        for (const k of lineKeys) row[k] = deriveValue(s.scopeData, k);
        return row;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSamples, lineKeys, deriveValue, horizonMs, version]);

  const restartTimestamps = useMemo(
    () => chartData.filter((r) => r._restart).map((r) => r.client_ts),
    [chartData],
  );

  // Latest non-break sample tag + total sample count for the active scope (chips/copy).
  const latest = activeSamples.length ? activeSamples[activeSamples.length - 1] : null;
  const sampleCount = activeSamples.filter((s) => s.scopeData != null).length;
  const capped = (seriesRef.current.get(scope)?.length ?? 0) >= COUNT_CAP;

  // headroom-unknown: metric is headroom AND the latest scope reports null headroom.
  const headroomUnknown = metric === 'headroom' && latest?.scopeData != null &&
    latest.scopeData.vendor.min_rate_limit_headroom == null;
  // vendor-latency max → gap note.
  const vendorMaxGap = metric === 'vendor_latency' && percentile === 'max';
  // selected ticker dropped from the latest window.
  const tickerDropped = scope !== 'global' && data != null && !(scope in data.per_ticker);

  const exportNow = useCallback(() => {
    const payload = {
      schema_version: 1, exported_at: new Date().toISOString(),
      metric, percentile, scope, horizon_min: horizonMin,
      samples: (seriesRef.current.get(scope) ?? []).map((s) => ({
        client_ts: s.client_ts, scope: s.scope, tag: s.tag, restart: !!s.restart,
        request_count: s.request_count, uptime_seconds: s.uptime_seconds,
        values: Object.fromEntries(lineKeys.map((k) => [k, deriveValue(s.scopeData, k)])),
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `convexa-latency-trend-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    setLastExport(payload.samples.length);
  }, [metric, percentile, scope, horizonMin, lineKeys, deriveValue]);

  return {
    data, error, loading,
    metric, setMetric, percentile, setPercentile, scope, setScope,
    horizonMin, setHorizonMin, cadenceSec, setCadenceSec,
    paused, autoPaused, togglePause, hiddenStages, toggleStage,
    scopes, lineKeys, chartData, restartTimestamps,
    sampleCount, capped, latestTag: latest?.tag ?? null,
    headroomUnknown, vendorMaxGap, tickerDropped,
    exportNow, lastExport,
  };
}

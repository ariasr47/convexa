/**
 * Risk-based regression: same-millisecond double polls (dev StrictMode remount fires the
 * mount-effect tick twice) must not store two samples with one client_ts — recharts keys
 * axis ticks per data point by value+coordinate, so duplicate timestamps collide React keys.
 */
import { fetchMetrics, MetricsAggregate, MetricsScope } from '@convexa/api';
import { act, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLatencyTrend } from './useLatencyTrend';

vi.mock('@convexa/api', () => ({ fetchMetrics: vi.fn() }));

const scopeData = (): MetricsScope => ({
  latency_total: { p50_ms: 10, p95_ms: 20, max_ms: 30, count: 5 },
  stages: [],
  cache: { hits: 1, misses: 1, hit_ratio: 0.5, current_data_age_seconds: 1 },
  vendor: { call_count: 2, latency_p50_ms: 5, latency_p95_ms: 9, min_rate_limit_headroom: null },
});

const aggregate = (): MetricsAggregate => ({
  instrumentation_enabled: true,
  gex_cache: {
    entries: 0,
    expirations: 0,
    hit_rate: 0,
    hits: 0,
    misses: 0,
    sets: 0,
    ttl_default_secs: 0,
    ttl_liquid_secs: 0,
    warm_errors: 0,
    warm_refreshes: 0,
    warm_symbols: [],
  },
  metrics_auth: 'disabled',
  operator: { ai_meter_scope: 'none', history_samples: 0, request_count: 7, scan_rows: 0, size_desc: '5m', uptime_seconds: 100 },
  recent_traces: [],
  window: { size_desc: '5m', uptime_seconds: 100, request_count: 7 },
  global: scopeData(),
  per_ticker: {},
});

describe('useLatencyTrend', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps one sample per millisecond when concurrent polls land on the same client_ts', async () => {
    vi.useFakeTimers();
    vi.mocked(fetchMetrics).mockResolvedValue(aggregate());

    // StrictMode remounts the effect → two immediate polls resolving at the same (fake) ms.
    const { result } = renderHook(() => useLatencyTrend(), { wrapper: StrictMode });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(vi.mocked(fetchMetrics).mock.calls.length).toBeGreaterThanOrEqual(2);
    const ts = result.current.chartData.map((r) => r.client_ts);
    expect(ts.length).toBeGreaterThan(0);
    expect(new Set(ts).size).toBe(ts.length);
  });
});

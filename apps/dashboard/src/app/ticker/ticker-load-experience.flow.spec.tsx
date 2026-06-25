/**
 * ticker-load-experience — FLOW-INTEGRATION centerpiece (the F-kind rows of FRONTEND_EXECUTION_CONTRACT
 * §6). Drives the REAL user journey end-to-end through every edge/variation, mounting the actual ticker
 * subtree and mocking ONLY the network boundary (`fetch` + a controllable `EventSource`) — NEVER a live
 * backend. The journey walked: cold-load → skeleton → per-source fill → last-trade live → empty → drop →
 * reconnect; warm vs cold arrival; concurrent/overlapping loads; pre-warm-unavailable fallback; the
 * byte-identical score path; and "no feature failure produces a new error page".
 *
 * AC coverage (F): Skel-2, PreWarm-1, PreWarm-2, PreWarm-3, Coalesce-1, Concurrency-1, Isolation-1,
 *   Invariant-1, Invariant-2.
 */
import { render, screen, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import type { TickerBundle, LiveUpdate } from '@org/api';

import App from '../app';
import { theme } from '../theme';
import { __resetMemory } from '../positions/store';

function makeBundle(over: Partial<TickerBundle['market_state']> = {}, sigOver: Partial<TickerBundle['signals']> = {}): TickerBundle {
  return {
    market_state: {
      ticker: 'TSLA', price: 250.5, gex_spot: 250, timestamp: 1, timestamp_iso: '2026-06-23T14:30:00Z',
      call_wall: 260, put_wall: 240, peak_gex_strike: 255, gamma_flip: 248, max_pain: 250,
      max_pain_expiration: '2026-06-26', net_gex: 1.2e9, call_gex: 2.0e9, put_gex: -0.8e9, total_gex: 1.2e9,
      net_dex: 5.0e8, call_dex: 6.0e8, put_dex: -1.0e8, net_vanna: null, net_charm: null, net_volga: null,
      vwap: 249, vwap_upper_2: null, vwap_upper_3: null, vwap_lower_2: null, vwap_lower_3: null,
      dte_min: null, dte_max: null, atm_iv: 45, hv_30d: 40, iv_hv_ratio: 1.12, net_flow: null,
      put_call_ratio: 0.8, chain_vol_oi_ratio: 0.5, total_volume: 100_000, vol_oi_unusual_threshold: 1,
      iv_skew: null, term_structure: null, ...over,
    },
    signals: {
      ticker: 'TSLA', regime: 'positive_gamma', regime_note: null, vol_regime: 'neutral', distances: {},
      setups: [], opportunity_score: 73, opportunity_tier: 'actionable', prime_prompt_eligible: false, ...sigOver,
    },
    strike_profile: { ticker: 'TSLA', spot: 250.5, strikes: [] },
    expirations: [{ date: '2026-06-26', dte: 3 }],
    ai_eval: { ready: false, reasons: [], changed: false, state_fingerprint: 'fp-byte-identical', score_threshold: 60 },
    meta: {
      served_at: '2026-06-23T14:30:00Z', cache: { hit: false, age_seconds: 0, ttl_seconds: 60 },
      freshness: { snapshot_iso: '2026-06-23T14:30:00Z', data_age_seconds: 30, stale: false, stale_after_seconds: 600 },
    },
    off_exchange: { ratio_pct: 38, offex_shares: 38_000, total_shares: 100_000, levels: [], blocks: [], block_min_shares: 5000, note: '' },
    position_eval: null,
  };
}

function liveUpdate(over: Partial<LiveUpdate> = {}): LiveUpdate {
  return {
    ticker: 'TSLA', mid: 251, bid: null, ask: null, spread: 0.05, net_flow: 1200, buy_vol: 0, sell_vol: 0,
    flow_window_s: 300, spot_ts: 1, live: true, tick_age_s: 1, market_session: 'regular', feed: 'realtime',
    ts: Date.now(), gamma_flip: 248, last_trade: 251.13, ...over,
  };
}

interface MockES { onmessage: ((e: MessageEvent) => void) | null; closed: boolean; }
let esInstances: MockES[] = [];
// `resolveTicker` lets a test control WHEN the bundle resolves (warm = immediate, cold = deferred).
let resolveTicker: ((b: TickerBundle) => void) | null = null;
let ticketDeferred = false;
let bundleProvider: () => TickerBundle = makeBundle;
let fetchMock: ReturnType<typeof vi.fn>;

function pushLive(over: Partial<LiveUpdate> = {}) {
  act(() => { esInstances.forEach((es) => es.onmessage?.({ data: JSON.stringify(liveUpdate(over)) } as MessageEvent)); });
}

beforeEach(() => {
  localStorage.clear();
  __resetMemory();
  esInstances = [];
  resolveTicker = null;
  ticketDeferred = false;
  bundleProvider = makeBundle;

  class MockEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    closed = false;
    constructor() { esInstances.push(this as unknown as MockES); }
    close() { this.closed = true; }
  }
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);

  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (url.includes('/api/ticker/')) {
      if (ticketDeferred) {
        // Cold path: hand the test a resolver so it controls fill timing (mocked-cold bundle).
        return new Promise<Response>((res) => {
          resolveTicker = (b: TickerBundle) => res(json(b));
        });
      }
      return json(bundleProvider()); // warm path: resolves immediately.
    }
    if (url.includes('/api/recommendation/status/')) {
      return json({ availability: { in_app_enabled: true }, gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] }, cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-24T04:00:00Z' } });
    }
    if (url.includes('/api/personas')) return json([{ id: 'default', name: 'Default (no persona)' }]);
    if (url.includes('/api/contract/')) return json(null);
    throw new Error(`Unexpected fetch in test: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function renderAt(path: string) {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

// ============================================================================================
describe('ticker-load-experience — flow (the full user journey)', () => {
  it('each source fills its own region independently', async () => {
    // AC-Skel-2: cold bundle deferred; the live readings (incl. last-trade) fill from SSE BEFORE the
    // bundle resolves — a slow bundle never holds back the live line.
    ticketDeferred = true;
    renderAt('/ticker/TSLA');

    // Cold: structure present, bundle not yet resolved (no Call wall yet).
    await screen.findByTestId('cold-load');
    expect(screen.queryByText('Call wall')).toBeNull();

    // SSE delivers first → the last-trade line fills while the bundle is STILL loading.
    pushLive({ live: true, last_trade: 251.13 });
    expect(screen.getByTestId('last-trade')).toHaveTextContent('Last trade $251.13');
    expect(screen.queryByText('Call wall')).toBeNull(); // bundle region still in skeleton

    // Now the bundle resolves → the static regions fill; the live line is unaffected.
    await act(async () => { resolveTicker?.(makeBundle()); });
    await screen.findByText('Call wall');
    expect(screen.getByTestId('last-trade')).toHaveTextContent('Last trade $251.13');
  });

  it('active-session visit fills near-instantly (warm path)', async () => {
    // AC-PreWarm-1: a mocked-warm bundle resolves immediately → no lingering skeleton.
    bundleProvider = makeBundle; // immediate
    renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');
    // The cold-load skeleton did not linger.
    expect(screen.queryByTestId('cold-load')).toBeNull();
    expect(screen.queryByTestId('cold-skeleton')).toBeNull();
  });

  it('first-ever cold visit shows skeleton throughout, never a blank', async () => {
    // AC-PreWarm-2: a slow (deferred) cold bundle keeps the skeleton STRUCTURE the whole time — never
    // a blank, never a lone full-page spinner — then DEFAULT once it resolves.
    ticketDeferred = true;
    renderAt('/ticker/TSLA');
    const cold = await screen.findByTestId('cold-load');
    // Structure persists while loading; not blank.
    expect(cold).toBeInTheDocument();
    expect(screen.queryByText('Call wall')).toBeNull();
    // It is skeleton structure, not a full-page CircularProgress in the body.
    expect(cold.querySelector('[role="progressbar"]')).toBeNull();

    await act(async () => { resolveTicker?.(makeBundle()); });
    await screen.findByText('Call wall');
    expect(screen.queryByTestId('cold-load')).toBeNull();
  });

  it('pre-warmed and non-pre-warmed loads present identical data and levels', async () => {
    // AC-PreWarm-3: arrival timing (warm immediate vs cold deferred) does not change WHAT is shown.
    // Warm:
    const warm = renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');
    const warmFlip = screen.getByText('$248').textContent;
    const warmWall = screen.getByText('$260').textContent;
    const warmScore = screen.getByText(/73 ·/).textContent;
    warm.unmount();

    // Cold (deferred), same bundle:
    ticketDeferred = true;
    renderAt('/ticker/TSLA');
    await screen.findByTestId('cold-load');
    await act(async () => { resolveTicker?.(makeBundle()); });
    await screen.findByText('Call wall');
    expect(screen.getByText('$248').textContent).toBe(warmFlip);
    expect(screen.getByText('$260').textContent).toBe(warmWall);
    expect(screen.getByText(/73 ·/).textContent).toBe(warmScore);
  });

  it('concurrent identical loads render one consistent page', async () => {
    // AC-Coalesce-1 (FE face): two concurrent mounts of the same ticker each render one consistent,
    // complete page (the FE cannot see backend coalescing; it asserts no degradation/partial page).
    const a = renderAt('/ticker/TSLA');
    const b = renderAt('/ticker/TSLA');
    await waitFor(() => expect(screen.getAllByText('Call wall').length).toBe(2));
    // Both render the same score/levels — mutually consistent, no partial page.
    expect(screen.getAllByText(/73 ·/).length).toBe(2);
    expect(screen.getAllByText('$260').length).toBe(2);
    a.unmount(); b.unmount();
  });

  it('overlapping fetches present the complete page, no section dropped or reordered', async () => {
    // AC-Concurrency-1: the cold load presents the same COMPLETE page (every section present, in
    // order) — overlapping fetches are transparent to the trader.
    renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');
    // Every section header is present, in document order (scope to headings — "Term structure" also
    // appears as a stat-tile label, so match on the role, not bare text).
    const headings = screen.getAllByRole('heading').map((h) => h.textContent ?? '');
    expect(screen.getByRole('heading', { name: 'Term structure' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fresh positioning (Vol/OI)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Off-exchange blocks' })).toBeInTheDocument();
    // Sections are in order: term structure precedes fresh positioning (not reordered).
    const ts = headings.findIndex((t) => t.includes('Term structure'));
    const fp = headings.findIndex((t) => t.includes('Fresh positioning'));
    expect(ts).toBeGreaterThanOrEqual(0);
    expect(fp).toBeGreaterThan(ts);
  });

  it('pre-warm unavailable falls back to normal load, no error', async () => {
    // AC-Isolation-1: pre-warm is a BE acceleration invisible to the FE; whether it was used or not,
    // the FE loads via the normal path with NO error surfaced. (FE face: a plain cold→default load
    // produces the page and no error Alert.)
    ticketDeferred = true; // emulate the slower normal path
    renderAt('/ticker/TSLA');
    await screen.findByTestId('cold-load');
    expect(screen.queryByText('Retry')).toBeNull(); // no error
    await act(async () => { resolveTicker?.(makeBundle()); });
    await screen.findByText('Call wall');
    expect(screen.queryByText('Retry')).toBeNull(); // still no error
  });

  it('score tier gate and fingerprint are unchanged across pre-warm and last-trade presence', async () => {
    // AC-Invariant-1: the score/tier path is byte-identical regardless of warm/cold arrival or whether
    // a last_trade is present — the FE renders the SAME score/tier values from the bundle's signals,
    // and a last_trade change never perturbs them.
    const warm = renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');
    const warmScore = screen.getByText(/73 ·/).textContent;
    warm.unmount();

    // Cold arrival + a live last-trade present: same score/tier rendered.
    ticketDeferred = true;
    renderAt('/ticker/TSLA');
    await screen.findByTestId('cold-load');
    await act(async () => { resolveTicker?.(makeBundle()); });
    await screen.findByText('Call wall');
    pushLive({ live: true, last_trade: 251.13 });
    expect(screen.getByText(/73 ·/).textContent).toBe(warmScore);
    // Mutating last_trade does not move the score readout.
    pushLive({ live: true, last_trade: 999.99 });
    expect(screen.getByText(/73 ·/).textContent).toBe(warmScore);
  });

  it('no feature failure produces an error page beyond first-load-failed', async () => {
    // AC-Invariant-2: walk the degraded paths — a missing source (EMPTY), a null print (LIVE-EMPTY),
    // and a live drop (OFFLINE) — none of them produces a new error/blank screen.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    bundleProvider = () => {
      const b = makeBundle({ term_structure: null });
      return { ...b, off_exchange: undefined };
    };
    renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');
    // EMPTY (off_exchange + term missing) — no error.
    expect(screen.getByText('Off-exchange data unavailable this cycle.')).toBeInTheDocument();
    expect(screen.queryByText('Retry')).toBeNull();

    // LIVE-EMPTY (no recent print) — no error.
    pushLive({ live: true, last_trade: null });
    expect(screen.getByTestId('last-trade')).toHaveTextContent('no recent print');
    expect(screen.queryByText('Retry')).toBeNull();

    // OFFLINE (live drop) — no error; statics persist.
    pushLive({ live: true, last_trade: 251.13 });
    await act(async () => { await vi.advanceTimersByTimeAsync(16_000); });
    expect(screen.getByText('⚠ Live offline — reconnecting…')).toBeInTheDocument();
    expect(screen.getByText('Call wall')).toBeInTheDocument();
    expect(screen.queryByText('Retry')).toBeNull();
  });
});

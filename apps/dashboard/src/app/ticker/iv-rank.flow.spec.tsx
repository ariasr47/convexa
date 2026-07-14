/**
 * iv-rank — Suite B (flow-integration CENTERPIECE, FRONTEND_EXECUTION_CONTRACT §5). Drives the REAL
 * ticker journey end-to-end, mounting the actual ticker subtree (via <App/>) and mocking ONLY the
 * network boundary (`fetch` + a controllable `EventSource`) — NEVER a live backend.
 *
 * Required matrix cases:
 *   - T-AC-1-flow  the widget appears in the static context-read family region (after MarketContext).
 *   - T-AC-15      a null `iv_rank` renders the muted line while sibling static widgets still render
 *                  (a null never blanks/errors the board).
 *   - T-AC-17      the ISOLATION centerpiece: under a simulated stream drop the iv-rank widget stays
 *                  visible + un-dimmed with NO `⏸ offline` — contrast a LiveTape tile that DID dim; on
 *                  reconnect the read is unchanged until the next bundle.
 *   - Extras:      a pre-feature bundle (key absent → `?? null`) renders the Unavailable state, console
 *                  clean; a live tick changes NOTHING in the static read; a new bundle updates it.
 */
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import type { IvRankRead, LiveUpdate, TickerBundle } from '@org/api';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../app';
import { __resetMemory } from '../positions/store';
import { theme } from '../theme';
import { IVR_WHOLE_EMPTY } from './widgets/_kit';

const IVR_DEFAULT: IvRankRead = {
  state: 'computed',
  rank: 82,
  rank_unavailable_reason: null,
  percentile: 74,
  band: 'premium_rich',
  current_iv: 41.2,
  window_sessions: 130,
  sample_count: 130,
  window_cap: 252,
  min_samples: 20,
  iv_basis: 'interpolated_30d',
  basis_dte: 30,
  window_descriptor: 'wire',
  basis_descriptor: 'wire',
  advisory_note: 'wire',
};

/** A sentinel meaning "omit the key entirely" (the pre-feature / older-backend shape) — distinct from
 *  a `null` field (a legitimate whole-read-null cycle). */
const ABSENT = Symbol('iv_rank absent');

function makeBundle(read: IvRankRead | null | typeof ABSENT = IVR_DEFAULT): TickerBundle {
  const market_state: TickerBundle['market_state'] = {
    ticker: 'TSLA',
    price: 250.5,
    gex_spot: 250,
    timestamp: 1,
    timestamp_iso: '2026-06-23T14:30:00Z',
    call_wall: 260,
    put_wall: 240,
    peak_gex_strike: 255,
    gamma_flip: 248,
    max_pain: 250,
    max_pain_expiration: '2026-06-26',
    net_gex: 1.2e9,
    call_gex: 2.0e9,
    put_gex: -0.8e9,
    total_gex: 1.2e9,
    net_dex: 5.0e8,
    call_dex: 6.0e8,
    put_dex: -1.0e8,
    net_vanna: null,
    net_charm: null,
    net_volga: null,
    vwap: 249,
    vwap_upper_2: null,
    vwap_upper_3: null,
    vwap_lower_2: null,
    vwap_lower_3: null,
    dte_min: null,
    dte_max: null,
    atm_iv: 45,
    hv_30d: 40,
    iv_hv_ratio: 1.12,
    net_flow: null,
    put_call_ratio: 0.8,
    chain_vol_oi_ratio: 0.5,
    total_volume: 100_000,
    vol_oi_unusual_threshold: 1,
    iv_skew: null,
    term_structure: null,
    dealer_flow_projection: null,
    market_context: null,
    iv_rank: read === ABSENT ? null : read,
  };
  if (read === ABSENT) delete (market_state as { iv_rank?: unknown }).iv_rank;
  return {
    market_state,
    signals: {
      ticker: 'TSLA',
      regime: 'positive_gamma',
      regime_note: null,
      vol_regime: 'neutral',
      distances: {},
      setups: [],
      opportunity_score: 73,
      opportunity_tier: 'actionable',
      prime_prompt_eligible: false,
    },
    strike_profile: { ticker: 'TSLA', spot: 250.5, strikes: [] },
    expirations: [
      { date: '2026-06-26', dte: 3 },
      { date: '2026-07-17', dte: 24 },
    ],
    ai_eval: {
      ready: false,
      reasons: [],
      changed: false,
      state_fingerprint: 'fp-byte-identical',
      score_threshold: 60,
    },
    meta: {
      served_at: '2026-06-23T14:30:00Z',
      cache: { hit: false, age_seconds: 0, ttl_seconds: 60 },
      freshness: {
        snapshot_iso: '2026-06-23T14:30:00Z',
        data_age_seconds: 30,
        stale: false,
        stale_after_seconds: 600,
      },
    },
    off_exchange: {
      ratio_pct: 38,
      offex_shares: 38_000,
      total_shares: 100_000,
      levels: [],
      blocks: [],
      block_min_shares: 5000,
      note: '',
    },
    position_eval: null,
  };
}

function liveUpdate(over: Partial<LiveUpdate> = {}): LiveUpdate {
  return {
    ticker: 'TSLA',
    mid: 251,
    bid: null,
    ask: null,
    spread: 0.05,
    net_flow: 1200,
    buy_vol: 0,
    sell_vol: 0,
    flow_window_s: 300,
    spot_ts: 1,
    live: true,
    tick_age_s: 1,
    market_session: 'regular',
    feed: 'realtime',
    ts: Date.now(),
    gamma_flip: 248,
    last_trade: 251.13,
    ...over,
  };
}

interface MockES {
  onmessage: ((e: MessageEvent) => void) | null;
  closed: boolean;
}
let esInstances: MockES[] = [];
let bundleForUrl: (url: string) => TickerBundle | { __error: number } = () => makeBundle();
let fetchMock: ReturnType<typeof vi.fn>;

function pushLive(over: Partial<LiveUpdate> = {}) {
  act(() => {
    esInstances.forEach((es) =>
      es.onmessage?.({ data: JSON.stringify(liveUpdate(over)) } as MessageEvent),
    );
  });
}

beforeEach(() => {
  localStorage.clear();
  __resetMemory();
  esInstances = [];
  bundleForUrl = () => makeBundle();

  class MockEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    closed = false;
    constructor() {
      esInstances.push(this as unknown as MockES);
    }
    close() {
      this.closed = true;
    }
  }
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);

  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const json = (b: unknown) =>
      new Response(JSON.stringify(b), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    if (url.includes('/api/ticker/')) {
      const b = bundleForUrl(url);
      if ('__error' in (b as object))
        return new Response('{"detail":"boom"}', { status: (b as { __error: number }).__error });
      return json(b);
    }
    if (url.includes('/api/recommendation/export/')) {
      return json({
        ticker: 'TSLA',
        as_of: '2026-06-23T14:30:00Z',
        context: null,
        persona_prompt: 'P',
        glossary: 'G',
        egress_note: 'note',
      });
    }
    if (url.includes('/api/recommendation/status/')) {
      return json({
        availability: { in_app_enabled: true },
        gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
        cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-24T04:00:00Z' },
      });
    }
    if (url.includes('/api/personas'))
      return json([{ id: 'default', name: 'Default (no persona)' }]);
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
describe('iv-rank — flow (the static-read journey)', () => {
  it('T-AC-1-flow: the widget appears in the static context-read family region, after Market context', async () => {
    renderAt('/ticker/TSLA');
    await screen.findByTestId('widget-iv-rank');
    // Both static-family siblings present, and IV rank sits AFTER Market context in DOM order.
    const mc = screen.getByTestId('widget-market-context');
    const ivr = screen.getByTestId('widget-iv-rank');
    expect(mc.compareDocumentPosition(ivr) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The computed read renders its headline.
    expect(within(ivr).getByTestId('ivr-rank-value')).toHaveTextContent('82');
  });

  it('T-AC-15: a null iv_rank renders the muted line while sibling widgets still render (a null never blanks/errors the board)', async () => {
    bundleForUrl = () => makeBundle(null);
    renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');
    expect(screen.getByText('$260')).toBeInTheDocument(); // walls render
    expect(screen.getByText(/73 ·/)).toBeInTheDocument(); // score renders
    expect(screen.getByTestId('ivr-whole-empty')).toHaveTextContent(IVR_WHOLE_EMPTY);
    expect(screen.queryByText('Retry')).toBeNull();
  });

  it('T-AC-17 (isolation centerpiece): on an SSE drop the widget is byte-identical + un-dimmed with NO ⏸, while LiveTape DID go offline; reconnect changes nothing until the next bundle', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    bundleForUrl = () => makeBundle(IVR_DEFAULT);
    renderAt('/ticker/TSLA');
    await screen.findByTestId('widget-iv-rank');

    const widget = screen.getByTestId('widget-iv-rank');
    const before = screen.getByTestId('iv-rank').textContent;

    // Go live, then drop the stream (no payload for > STREAM_OFFLINE_MS).
    pushLive({ live: true, last_trade: 251.13 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });

    // CONTRAST CONTROL: the LiveTape tiles DID go offline (⏸ offline caption present there).
    const liveTape = screen.getByTestId('live-tape');
    expect(within(liveTape).getAllByText('⏸ offline').length).toBeGreaterThan(0);

    // The IV rank widget: byte-identical, un-dimmed, NO ⏸/offline caption of its own.
    expect(screen.getByTestId('iv-rank').textContent).toBe(before);
    expect(within(widget).queryByText(/⏸/)).toBeNull();
    expect(within(widget).queryByText(/offline/i)).toBeNull();
    expect(
      getComputedStyle(widget).opacity === '' || getComputedStyle(widget).opacity === '1',
    ).toBe(true);
    expect(within(widget).getByTestId('ivr-rank-value')).toHaveTextContent('82');

    // Reconnect (a new payload clears offline): the read is UNCHANGED until the next bundle.
    pushLive({ live: true, mid: 260 });
    expect(screen.getByTestId('iv-rank').textContent).toBe(before);
  });

  it('extra: a live tick changes NOTHING in the static read; a NEW bundle with a different read updates it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let current: IvRankRead = IVR_DEFAULT;
    bundleForUrl = () => makeBundle(current);
    renderAt('/ticker/TSLA');
    await screen.findByTestId('widget-iv-rank');

    const before = screen.getByTestId('iv-rank').textContent;
    pushLive({ live: true, mid: 300, net_flow: 9_999, last_trade: 300 });
    expect(screen.getByTestId('iv-rank').textContent).toBe(before);

    // Bundle B (next poll) carries a different rank → the widget re-renders from it.
    current = { ...IVR_DEFAULT, rank: 18, band: 'premium_cheap' };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    await waitFor(() => expect(screen.getByTestId('ivr-rank-value')).toHaveTextContent('18'));
    expect(screen.getByTestId('ivr-band')).toHaveTextContent('premium cheap');
  });

  it('extra: a PRE-FEATURE bundle (key absent → ?? null) renders the Unavailable state, console clean, board intact', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    bundleForUrl = () => makeBundle(ABSENT);
    renderAt('/ticker/TSLA');
    await screen.findByTestId('ivr-whole-empty');
    expect(screen.getByText('Call wall')).toBeInTheDocument();
    expect(screen.getByText(/73 ·/)).toBeInTheDocument();
    expect(screen.queryByText('Retry')).toBeNull();
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

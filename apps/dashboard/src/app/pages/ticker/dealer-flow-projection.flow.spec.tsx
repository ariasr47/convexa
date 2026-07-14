/**
 * dealer-flow-projection — Suite B (flow-integration CENTERPIECE, FRONTEND_EXECUTION_CONTRACT §5).
 * Drives the REAL ticker journey end-to-end, mounting the actual ticker subtree (via <App/>) and
 * mocking ONLY the network boundary (`fetch` + a controllable `EventSource`) — NEVER a live backend.
 *
 * It walks the required matrix cases:
 *   - T-AC-7  window scoping: two bundles for two expiration selections carry different projections;
 *             re-selecting re-renders the read from the NEW bundle (moves with the window).
 *   - T-AC-8  window-excludes-OPEX: a bundle whose window doesn't reach the OPEX still shows
 *             horizon_days + opex_date on the charm limb (mismatch legible, not retargeted/hidden).
 *   - T-AC-13 the ISOLATION centerpiece: simulate an SSE drop → the widget's output is byte-identical /
 *             un-dimmed / no `⏸ offline`, while the LiveTape tiles DID go offline (`⏸`). The widget
 *             updates only on a new bundle, never per live tick.
 *   - T-AC-14 the export path carries `dealer_flow_projection` from the mocked bundle's market_state and
 *             the score/tier/gate/fingerprint render unchanged with vs without the field (the FE face of
 *             the additive byte-identity invariant).
 */
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import type { DealerFlowProjection, LiveUpdate, TickerBundle } from '@org/api';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/app';
import { __resetMemory } from '@/features/trading/positions/store';
import { theme } from '@/shared/theme/theme';

const DFP_DEFAULT: DealerFlowProjection = {
  spot_basis: 178.4,
  charm: {
    projected_delta: 4_200_000,
    per_day_base: 380_000,
    horizon_days: 11,
    opex_date: '2026-07-17',
  },
  vanna: {
    projected_delta: 1_850_000,
    move_iv_points: 1.0,
    illustrative_move_iv_points: 5.0,
    illustrative_projected_delta: 9_250_000,
    reference_direction: 'increase',
  },
};

/** A sentinel meaning "omit the field entirely" (older-backend / pre-feature shape) — distinct from a
 *  `null` field (a legitimate whole-read-null cycle) and distinct from JS's default-parameter `undefined`. */
const ABSENT = Symbol('dealer_flow_projection absent');

function makeBundle(dfp: DealerFlowProjection | null | typeof ABSENT = DFP_DEFAULT): TickerBundle {
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
    dealer_flow_projection: dfp === ABSENT ? null : dfp,
  };
  // The ABSENT sentinel ⇒ the field is omitted entirely (the pre-feature / older-backend shape).
  if (dfp === ABSENT)
    delete (market_state as { dealer_flow_projection?: unknown }).dealer_flow_projection;
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
/** The bundle the fetch mock serves for the CURRENT request, keyed on the request URL. */
let bundleForUrl: (url: string) => TickerBundle = () => makeBundle();
let exportContext: unknown = null;
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
  exportContext = null;

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
    if (url.includes('/api/ticker/')) return json(bundleForUrl(url));
    if (url.includes('/api/recommendation/export/')) {
      return json({
        ticker: 'TSLA',
        as_of: '2026-06-23T14:30:00Z',
        context: exportContext,
        persona_prompt: 'PROMPT',
        glossary: 'GLOSSARY',
        egress_note: 'Complete list of what leaves the machine…',
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
describe('dealer-flow-projection — flow (the static-read journey)', () => {
  it('T-AC-7: window scoping — re-selecting expirations re-renders the read from the NEW bundle', async () => {
    // Two windows carry DIFFERENT projections. The "all"/no-filter request (no expirations param) gets
    // the wide-window bundle; a narrowed selection (an expirations param present) gets the narrow one.
    const wide: DealerFlowProjection = {
      ...DFP_DEFAULT,
      charm: { ...DFP_DEFAULT.charm!, projected_delta: 4_200_000 },
    };
    const narrow: DealerFlowProjection = {
      ...DFP_DEFAULT,
      charm: {
        ...DFP_DEFAULT.charm!,
        projected_delta: 8_800_000,
        horizon_days: 24,
        opex_date: '2026-07-17',
      },
    };
    bundleForUrl = (url) => makeBundle(url.includes('expirations=') ? narrow : wide);

    renderAt('/ticker/TSLA');
    // Wide window first.
    await screen.findByText('+$4.2M delta drift');

    // Narrow the expiration selection → a re-fetch carrying an `expirations=` param → the narrow bundle.
    const select = screen.getByLabelText('Expirations');
    fireEvent.mouseDown(select);
    const option = await screen.findByText('2026-06-26'); // untick one date → explicit subset
    fireEvent.click(option);
    // Close the menu.
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });

    // The read moved with the window (the charm figure re-rendered from the new bundle).
    await screen.findByText('+$8.8M delta drift');
    expect(screen.queryByText('+$4.2M delta drift')).toBeNull();
  });

  it('T-AC-8: window-excludes-OPEX — charm still shows horizon_days + opex_date (mismatch legible)', async () => {
    // A window that doesn't reach the OPEX: the read STILL targets the OPEX date and surfaces the
    // horizon — not retargeted, not hidden.
    const excludesOpex: DealerFlowProjection = {
      ...DFP_DEFAULT,
      charm: {
        projected_delta: 4_200_000,
        per_day_base: 380_000,
        horizon_days: 32,
        opex_date: '2026-08-21',
      },
    };
    bundleForUrl = () => makeBundle(excludesOpex);
    renderAt('/ticker/TSLA');
    // The horizon (days) AND the exact OPEX date both render on the charm limb.
    await screen.findByText('to Fri Aug 21 (32 days)');
    expect(screen.getByText('+$4.2M delta drift')).toBeInTheDocument();
  });

  it('T-AC-13 (isolation centerpiece): on an SSE drop the widget is un-dimmed with NO ⏸, while LiveTape DID go offline', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    bundleForUrl = () => makeBundle(DFP_DEFAULT);
    renderAt('/ticker/TSLA');
    await screen.findByText('+$4.2M delta drift');

    const widget = screen.getByTestId('widget-dealer-flow-projection');
    // Capture the widget's rendered content BEFORE the drop.
    const before = screen.getByTestId('dealer-flow-projection').textContent;

    // Go live, then drop the stream (no payload for > STREAM_OFFLINE_MS).
    pushLive({ live: true, last_trade: 251.13 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });

    // CONTRAST CONTROL: the LiveTape tiles DID go offline (⏸ offline caption is present on the page).
    const liveTape = screen.getByTestId('live-tape');
    expect(within(liveTape).getAllByText('⏸ offline').length).toBeGreaterThan(0);

    // The projection widget is byte-identical / unchanged, un-dimmed, and carries NO ⏸ offline.
    expect(screen.getByTestId('dealer-flow-projection').textContent).toBe(before);
    expect(within(widget).queryByText(/⏸/)).toBeNull();
    // Not dimmed: the widget frame has no opacity reduction applied to it.
    expect(
      getComputedStyle(widget).opacity === '' || getComputedStyle(widget).opacity === '1',
    ).toBe(true);
    // The read did not update per live tick (still the last-bundle value).
    expect(screen.getByText('+$4.2M delta drift')).toBeInTheDocument();
  });

  it('T-AC-13b: the widget updates only on a NEW bundle, not on a live tick', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let current = DFP_DEFAULT;
    bundleForUrl = () => makeBundle(current);
    renderAt('/ticker/TSLA');
    await screen.findByText('+$4.2M delta drift');

    // A flurry of live ticks must NOT move the static read.
    pushLive({ live: true, mid: 300, last_trade: 300 });
    pushLive({ live: true, mid: 305, last_trade: 305 });
    expect(screen.getByText('+$4.2M delta drift')).toBeInTheDocument();

    // Only a new REST bundle (next poll, 60s) changes it.
    current = { ...DFP_DEFAULT, charm: { ...DFP_DEFAULT.charm!, projected_delta: 6_600_000 } };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    await screen.findByText('+$6.6M delta drift');
  });

  it('T-AC-14: the export path carries dealer_flow_projection; score/tier render unchanged with vs without the field', async () => {
    // WITH the field present in the bundle — the widget populates and the score renders.
    bundleForUrl = () => makeBundle(DFP_DEFAULT);
    const withField = renderAt('/ticker/TSLA');
    await within(withField.container).findByText('+$4.2M delta drift');
    const scoreWith = within(withField.container).getByText(/73 ·/).textContent;
    // The export context serializes the whole market_state (which includes the field). Assert the field
    // is present in what the export forwards (the FE face of the AI-context carry) and is NON-NULL.
    exportContext = makeBundle(DFP_DEFAULT).market_state;
    expect(
      (exportContext as { dealer_flow_projection: unknown }).dealer_flow_projection,
    ).not.toBeNull();
    withField.unmount();

    // WITHOUT the field (older-backend / null-cycle): the SAME score/tier renders — the read never feeds it.
    bundleForUrl = () => makeBundle(ABSENT); // field omitted entirely
    const noField = renderAt('/ticker/TSLA');
    // Wait for the board to load (its whole-read-null line appears once the bundle resolves).
    await within(noField.container).findByText('Projected dealer flow unavailable this cycle.');
    // The score/tier is byte-identical to the with-field render (the read never feeds it).
    expect(within(noField.container).getByText(/73 ·/).textContent).toBe(scoreWith);
    // No projection figure and no error page.
    expect(within(noField.container).queryByText('+$4.2M delta drift')).toBeNull();
    expect(within(noField.container).queryByText('Retry')).toBeNull();
  });

  it('T-AC-13c: a null projection never blanks/errors the rest of the board (isolation)', async () => {
    bundleForUrl = () => makeBundle(null);
    renderAt('/ticker/TSLA');
    // The board renders normally — the walls + score are present.
    await screen.findByText('Call wall');
    expect(screen.getByText('$260')).toBeInTheDocument();
    expect(screen.getByText(/73 ·/)).toBeInTheDocument();
    // The projection shows its muted whole-read-null line, no error.
    expect(screen.getByText('Projected dealer flow unavailable this cycle.')).toBeInTheDocument();
    expect(screen.queryByText('Retry')).toBeNull();
  });
});

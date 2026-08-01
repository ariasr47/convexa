/**
 * Ticker page (`/ticker/:symbol`) — RISK-BASED test suite (per the amended QA rule,
 * `.claude/agents/qa-verify.md` §4, 2026-07-13). Consolidates the former per-AC mirrors
 * (ticker-load-experience{,.flow}, ai-context-pack.flow, dealer-flow-projection.flow, iv-rank.flow)
 * into the invariants where a silent regression is plausible AND invisible to a reviewer:
 *
 *   1. THE page contract — stream isolation (`live-vs-static-isolation`), walked end-to-end ONCE:
 *      live tick → SSE drop (live tiles dim + ⏸, last-known values retained, statics byte-identical)
 *      → reconnect → post-success refresh failure (soft warning, bundle kept). Three DISTINCT
 *      degraded states: cold-load skeleton ≠ offline-degrade ≠ unavailable-this-cycle.
 *   2. Skeleton-first load — per-source fill: a slow REST bundle never holds the SSE line hostage.
 *   3. Independent nullability (`best-effort-isolated-or-null`) — one parameterized null matrix.
 *   4. Wire-label authority (`digested-labels-not-raw-dump`) — a fixture whose labels CONTRADICT
 *      their scalars proves the FE renders the wire label and never re-derives it.
 *   5. Model-read self-description (`model-read-carries-its-assumptions`) — the basis element exists
 *      alongside the value element (presence, not wording).
 *   6. `mid` is the anchor; `last_trade` is display-only + fail-honest (never a stale print).
 *
 * NOT asserted here (visible + intentional → review/QA; brittle to automate): copy/tooltips/titles,
 * per-widget skeleton presence, styling/sx, section ordering, warm-vs-cold arrival equivalence,
 * export-drawer echo tests (they only asserted the mock they fed), window-rescoping re-fetches.
 * Widget-internal states live in the widgets' own specs (`widgets/**`).
 *
 * Mounts the REAL app subtree via the route table, mocking ONLY the network boundary (`fetch` + a
 * controllable `EventSource`) — NEVER a live backend. The strict fetch mock THROWS on any unexpected
 * call, so "no hidden endpoint" is enforced by construction.
 */
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import type {
  DealerFlowProjection,
  IvRankRead,
  LiveUpdate,
  MarketContextPack,
  TermStructure,
  TickerBundle,
} from '@org/api';
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/app';
import { makeBundle } from '@/features/auth/testBackend';
import { __resetMemory } from '@/features/trading/positions/store';
import { theme } from '@/shared/theme/theme';

// ---- Rich static-read fixtures (every independently-nullable section POPULATED) ---------------
const IVR_FIX: IvRankRead = {
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

const DFP_FIX: DealerFlowProjection = {
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

const PACK_FIX: MarketContextPack = {
  trend_momentum: {
    as_of_session: '2026-07-03',
    direction: {
      label: 'uptrend',
      close: 178.4,
      ema20: 176.21,
      ema50: 171.83,
      window: 'close vs EMA20 vs EMA50, daily closes',
      thresholds: 'fixed',
    },
    strength: {
      label: 'strong',
      adx: 28.4,
      window: 'ADX(14), Wilder, daily high/low/close',
      thresholds: 'fixed',
    },
    momentum: {
      label: 'neutral',
      rsi: 51.2,
      window: 'RSI(14), Wilder, daily closes',
      thresholds: 'fixed',
    },
  },
  gex_profile_shape: {
    concentration: 0.41,
    concentration_label: 'concentrated',
    balance: 0.34,
    balance_label: 'above_skewed',
    center_of_mass_distance: 0.012,
    eligible_strikes: 23,
    spot_basis: 178.4,
    thresholds: 'fixed',
  },
  flow_vs_positioning: {
    flow_basis: 'today volume vs standing OI (wire descriptor)',
    location: { label: 'rotating', distribution_shift: 0.42, thresholds: 'fixed' },
    composition: {
      label: 'consistent',
      volume_pcr: 0.92,
      oi_pcr: 0.88,
      tilt_ratio: 1.05,
      thresholds: 'fixed',
    },
  },
  atr: {
    as_of_session: '2026-07-03',
    close_basis: 178.4,
    method: 'simple mean of true range (wire descriptor)',
    atr_5d: { value: 4.12, pct_of_close: 2.31, window_bars: 5 },
    atr_14d: { value: 3.87, pct_of_close: 2.17, window_bars: 14 },
    atr_30d: { value: 3.51, pct_of_close: 1.97, window_bars: 30 },
  },
};

// A CONSISTENT term structure (label matches scalars) for the rich default.
const TERM_FIX: TermStructure = {
  points: [
    { dte: 7, expiration: '2026-06-26', atm_iv: 40 },
    { dte: 30, expiration: '2026-07-17', atm_iv: 45 },
  ],
  state: 'contango',
  near_iv: 40,
  far_iv: 45,
  slope: 5,
};

/** Shared bundle + every independently-nullable static section populated. */
function richBundle(
  over: Partial<TickerBundle['market_state']> = {},
  sigOver: Partial<TickerBundle['signals']> = {},
): TickerBundle {
  const b = makeBundle();
  return {
    ...b,
    market_state: {
      ...b.market_state,
      term_structure: TERM_FIX,
      dealer_flow_projection: DFP_FIX,
      market_context: PACK_FIX,
      iv_rank: IVR_FIX,
      ...over,
    },
    signals: { ...b.signals, ...sigOver },
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

// ---- Mock network boundary (the ONLY thing mocked) ---------------------------------------------
interface MockES {
  onmessage: ((e: MessageEvent) => void) | null;
  closed: boolean;
}
let esInstances: MockES[] = [];
let tickerOk = true;
let tickerDeferred = false; // cold path: the bundle resolves only when the test says so
let resolveTicker: ((b: TickerBundle) => void) | null = null;
let bundleProvider: () => TickerBundle = richBundle;
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
  tickerOk = true;
  tickerDeferred = false;
  resolveTicker = null;
  bundleProvider = richBundle;

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

  // STRICT mock: only the endpoints the page legitimately reads; anything else throws.
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const json = (b: unknown) =>
      new Response(JSON.stringify(b), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    if (url.includes('/api/auth/session'))
      return json({ authenticated: false, user: null, google_available: false, settings: null });
    if (url.includes('/api/ticker/')) {
      if (tickerDeferred)
        return new Promise<Response>((res) => {
          resolveTicker = (b: TickerBundle) => res(json(b));
        });
      if (!tickerOk) return new Response('error', { status: 500 });
      return json(bundleProvider());
    }
    if (url.includes('/api/recommendation/status/')) {
      return json({
        availability: { in_app_enabled: true },
        gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
        cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-24T04:00:00Z' },
      });
    }
    if (url.includes('/api/personas')) return json([{ id: 'default', name: 'Default (no persona)' }]);
    if (url.includes('/api/contract/')) return json(null);
    throw new Error(`Unexpected fetch from Ticker page: ${url}`);
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

const STATIC_WIDGETS = [
  'widget-market-context',
  'widget-iv-rank',
  'widget-dealer-flow-projection',
] as const;

// =================================================================================================
// 1. THE page contract — stream isolation, walked end-to-end once (the centerpiece)
// =================================================================================================
describe('Ticker · stream isolation (live-vs-static-isolation)', () => {
  it('SSE drop degrades ONLY live tiles (values retained); statics byte-identical; reconnect recovers; a later refresh failure keeps the bundle behind a soft warning', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');
    // LOADING look is gone once loaded — it never reappears in any later degraded state.
    expect(screen.queryByTestId('cold-skeleton')).toBeNull();

    // A live tick arrives: the anchor flips to the NBBO mid; the last-trade line fills.
    pushLive({ live: true, mid: 251, gamma_flip: 248, last_trade: 251.13 });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('TSLA · $251.00');
    expect(screen.getByTestId('last-trade')).toHaveTextContent('Last trade $251.13');

    // Capture the static reads BEFORE the drop (byte-identity is the invariant).
    const staticBefore = STATIC_WIDGETS.map((id) => screen.getByTestId(id).textContent);

    // DROP: no payload for > STREAM_OFFLINE_MS → the payload-gap watchdog fires.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });

    // Live tiles degrade: dimmed + ⏸, last-known value RETAINED (never blanked).
    expect(within(screen.getByTestId('live-tape')).getAllByText('⏸ offline').length).toBeGreaterThan(0);
    expect(screen.getByTestId('last-trade')).toHaveTextContent('⏸ Last trade $251.13');
    expect(screen.getByText('⚠ Live offline — reconnecting…')).toBeInTheDocument();

    // Statics keep rendering the last bundle, byte-identical, with NO offline look of their own.
    STATIC_WIDGETS.forEach((id, i) => {
      const w = screen.getByTestId(id);
      expect(w.textContent).toBe(staticBefore[i]);
      expect(within(w).queryByText(/⏸/)).toBeNull();
    });
    expect(screen.getByTestId('widget-gex-strike-profile')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('dealer-positioning')).getByText('$260'),
    ).toBeInTheDocument(); // call wall value intact
    // OFFLINE is neither the cold skeleton nor a refresh/error state (3 distinct states).
    expect(screen.queryByTestId('cold-skeleton')).toBeNull();
    expect(screen.queryByText(/Couldn't refresh/)).toBeNull();
    expect(screen.queryByText('Retry')).toBeNull();

    // RECONNECT: the next payload clears offline; the live look returns; statics unmoved.
    pushLive({ live: true, mid: 251, gamma_flip: 248, last_trade: 251.55 });
    expect(screen.getByTestId('last-trade')).toHaveTextContent('● Last trade $251.55');
    expect(screen.queryByText('⚠ Live offline — reconnecting…')).toBeNull();
    STATIC_WIDGETS.forEach((id, i) => expect(screen.getByTestId(id).textContent).toBe(staticBefore[i]));

    // POST-SUCCESS REFRESH FAILURE: the next poll 500s → soft warning, bundle KEPT, no error page.
    tickerOk = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    await screen.findByText(/Couldn't refresh/);
    expect(screen.getByText('Call wall')).toBeInTheDocument();
    STATIC_WIDGETS.forEach((id, i) => expect(screen.getByTestId(id).textContent).toBe(staticBefore[i]));
    expect(screen.queryByText('Retry')).toBeNull(); // NOT the cold-start error screen
    expect(screen.queryByTestId('cold-skeleton')).toBeNull(); // and NOT the cold skeleton
  });
});

// =================================================================================================
// 2. Skeleton-first load — per-source fill (REST bundle vs SSE are independent)
// =================================================================================================
describe('Ticker · skeleton-first load', () => {
  it('a slow bundle keeps the skeleton structure (no spinner, no blank) while the SSE line fills independently', async () => {
    tickerDeferred = true;
    renderAt('/ticker/TSLA');

    // Cold: skeleton structure present, no full-page spinner, bundle regions empty.
    const cold = await screen.findByTestId('cold-load');
    expect(within(cold).getAllByTestId('cold-skeleton').length).toBeGreaterThan(0);
    expect(within(cold).queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText('Call wall')).toBeNull();

    // SSE delivers FIRST → the live line fills while the bundle is still pending.
    pushLive({ live: true, last_trade: 251.13 });
    expect(screen.getByTestId('last-trade')).toHaveTextContent('Last trade $251.13');
    expect(screen.queryByText('Call wall')).toBeNull();

    // Bundle resolves → statics fill; the live line is unaffected; the skeleton clears for good.
    await act(async () => {
      resolveTicker?.(richBundle());
    });
    await screen.findByText('Call wall');
    expect(screen.getByTestId('last-trade')).toHaveTextContent('Last trade $251.13');
    expect(screen.queryByTestId('cold-skeleton')).toBeNull();
  });
});

// =================================================================================================
// 3. Independent nullability — the null matrix (best-effort-isolated-or-null)
// =================================================================================================
const NULLABLE_SECTIONS: Array<[field: string, emptyCopy: string]> = [
  ['iv_rank', 'IV rank unavailable this cycle.'],
  ['market_context', 'Market context unavailable this cycle.'],
  ['dealer_flow_projection', 'Projected dealer flow unavailable this cycle.'],
  ['off_exchange', 'Off-exchange data unavailable this cycle.'],
  ['term_structure', 'Term structure unavailable this cycle.'],
];

describe('Ticker · independent nullability (null matrix)', () => {
  it.each(NULLABLE_SECTIONS)(
    'null %s → only that section shows its empty copy; every other section renders intact',
    async (field, emptyCopy) => {
      bundleProvider = () => {
        const b = richBundle();
        if (field === 'off_exchange') return { ...b, off_exchange: undefined };
        return { ...b, market_state: { ...b.market_state, [field]: null } };
      };
      renderAt('/ticker/TSLA');
      await screen.findByText('Call wall');

      // The nulled section degrades to its own muted line…
      expect(screen.getByText(emptyCopy)).toBeInTheDocument();
      // …and it is the ONLY one degraded — no sibling section went empty with it.
      for (const [other, otherCopy] of NULLABLE_SECTIONS)
        if (other !== field) expect(screen.queryByText(otherCopy)).toBeNull();
      // The board around it is intact — walls + score render, no error page.
      const dealer = screen.getByTestId('dealer-positioning');
      expect(within(dealer).getByText('$260')).toBeInTheDocument();
      expect(within(dealer).getByText(/42 ·/)).toBeInTheDocument();
      expect(screen.queryByText('Retry')).toBeNull();
    },
  );

  it('a pre-feature bundle (optional keys ABSENT, statics null) renders every empty state — board intact, console clean', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    bundleProvider = () => {
      const b = richBundle({ term_structure: null, dealer_flow_projection: null });
      const ms = { ...b.market_state };
      delete ms.market_context; // older-backend shape: keys omitted entirely, not null
      delete ms.iv_rank;
      return { ...b, market_state: ms, off_exchange: undefined };
    };
    renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');
    for (const [, emptyCopy] of NULLABLE_SECTIONS)
      expect(screen.getByText(emptyCopy)).toBeInTheDocument();
    expect(within(screen.getByTestId('dealer-positioning')).getByText('$260')).toBeInTheDocument();
    expect(screen.queryByText('Retry')).toBeNull();
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

// =================================================================================================
// 4. Wire-label authority — labels come from the wire via closed lookups, NEVER re-derived
// =================================================================================================
describe('Ticker · wire-label authority (digested-labels-not-raw-dump)', () => {
  it('when a label CONTRADICTS its scalar, the LABEL wins (iv-rank band, trend direction, term state, gamma regime)', async () => {
    const tmFix = PACK_FIX.trend_momentum;
    const dirFix = tmFix?.direction;
    if (!tmFix || !dirFix) throw new Error('PACK_FIX fixture must carry trend_momentum.direction');
    bundleProvider = () =>
      richBundle(
        {
          // Rank 82 (≥70 would re-derive "rich") but the wire band says CHEAP.
          iv_rank: { ...IVR_FIX, rank: 82, band: 'premium_cheap' },
          // Uptrend scalars (close > EMA20 > EMA50) but the wire label says DOWNTREND.
          market_context: {
            ...PACK_FIX,
            trend_momentum: {
              ...tmFix,
              direction: { ...dirFix, label: 'downtrend' },
            },
          },
          // Backwardation scalars (near 60 > far 40, slope −20) but the wire state says CONTANGO.
          term_structure: {
            points: [
              { dte: 7, expiration: '2026-06-26', atm_iv: 60 },
              { dte: 30, expiration: '2026-07-17', atm_iv: 40 },
            ],
            state: 'contango',
            near_iv: 60,
            far_iv: 40,
            slope: -20,
          },
        },
        // Positive net_gex scalar (+1.2e9 in the shared bundle) but the wire regime says NEGATIVE.
        { regime: 'negative_gamma' },
      );
    renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');

    // IV-rank band: the wire label renders; the scalar-derived alternative does not.
    const ivr = screen.getByTestId('widget-iv-rank');
    expect(within(ivr).getByTestId('ivr-band')).toHaveTextContent('premium cheap');
    expect(within(ivr).queryByText('premium rich')).toBeNull();

    // Trend direction: the wire label renders; nothing re-derives "Uptrend" from the EMAs.
    const mc = screen.getByTestId('widget-market-context');
    expect(within(mc).getByText('Downtrend')).toBeInTheDocument();
    expect(within(mc).queryByText('Uptrend')).toBeNull();

    // Term-structure state: the wire state renders despite inverted IVs.
    expect(screen.getByText('ATM IV by tenor · contango')).toBeInTheDocument();

    // Gamma regime chip: the wire regime renders despite a positive net_gex.
    expect(screen.getByText('negative gamma')).toBeInTheDocument();
  });
});

// =================================================================================================
// 5. Model-read self-description — the basis/assumption line rides WITH its value
// =================================================================================================
describe('Ticker · model-read self-description', () => {
  it('the iv-rank basis line and the projection horizon render alongside their values', async () => {
    renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');

    // IV rank: the value element AND its window/N basis element share the widget body.
    const ivr = screen.getByTestId('widget-iv-rank');
    expect(within(ivr).getByTestId('ivr-rank-value')).toBeInTheDocument();
    expect(within(ivr).getByTestId('ivr-basis')).toBeInTheDocument();

    // Dealer-flow projection: the charm figure AND its horizon element share the widget body.
    const dfp = screen.getByTestId('widget-dealer-flow-projection');
    expect(within(dfp).getByTestId('dfp-charm-drift')).toBeInTheDocument();
    expect(within(dfp).getByTestId('dfp-charm-horizon')).toBeInTheDocument();
  });
});

// =================================================================================================
// 6. `mid` is the anchor; `last_trade` is display-only + fail-honest
// =================================================================================================
describe('Ticker · last_trade is display-only', () => {
  it('a diverging or vanishing last_trade never moves the anchor/levels, and a null print is never shown stale', async () => {
    renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');

    pushLive({ live: true, mid: 251, gamma_flip: 248, last_trade: 251.13 });
    const anchor = () => screen.getByRole('heading', { level: 1 });
    expect(anchor()).toHaveTextContent('TSLA · $251.00');
    const flipTile = () => within(screen.getByTestId('live-tape')).getByText('$248');
    expect(flipTile()).toBeInTheDocument();

    // A wildly diverging print moves NOTHING but its own readout.
    pushLive({ live: true, mid: 251, gamma_flip: 248, last_trade: 999.99 });
    expect(anchor()).toHaveTextContent('TSLA · $251.00');
    expect(flipTile()).toBeInTheDocument();
    expect(within(screen.getByTestId('dealer-positioning')).getByText('$260')).toBeInTheDocument();

    // No recent print → the honest empty, NEVER the prior value styled current; anchor unmoved.
    pushLive({ live: true, mid: 251, gamma_flip: 248, last_trade: null });
    const lt = screen.getByTestId('last-trade');
    expect(lt).toHaveTextContent('no recent print');
    expect(lt).not.toHaveTextContent('999.99');
    expect(lt).not.toHaveTextContent('251.13');
    expect(anchor()).toHaveTextContent('TSLA · $251.00');
  });
});

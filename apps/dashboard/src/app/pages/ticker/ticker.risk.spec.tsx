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
import type {
  DealerFlowProjection,
  IvRankRead,
  LiveUpdate,
  MarketContextPack,
  TermStructure,
  TickerBundle,
} from '@convexa/api';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/app';
import { makeBundle } from '@/features/auth/testBackend';
import { __resetMemory } from '@/features/trading/positions/store';
import { theme } from '@/shared/theme/theme';
import { allRulesForClass, emotionClassOf, joinedStyleText } from './widgets/_kit/emotionCssReader';

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
let tickerPaused = false; // no-vendor-production-posture F2: the 503 market_data_paused reply
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
  tickerPaused = false;
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
      if (tickerPaused)
        return new Response(
          JSON.stringify({ detail: 'Market data is paused.', code: 'market_data_paused' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        );
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
    if (url.includes('/api/personas'))
      return json([{ id: 'default', name: 'Default (no persona)' }]);
    if (url.includes('/api/contract/')) return json(null);
    // index-first-defaults: the page's silent best-effort universe read (single-name caveat). TSLA
    // is a member here so the caveat stays out of this suite's frame (its states live in
    // `single-name-caveat.spec.tsx`).
    if (url.includes('/api/scan/universe'))
      return json({ symbols: ['SPY', 'QQQ', 'TSLA'], universe_size: 3 });
    if (url.includes('/history'))
      return json({ symbol: 'TSLA', samples: [], basis: 'test structure history' });
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

// PASS 2 change 8 (owner ruling `context-band-is-the-designs-card-list`): `widget-iv-rank` dropped —
// `IvRank` no longer mounts on `/ticker` (its card left the context band; the component/testid still
// exist for its own consumers, just not this page). The remaining two are still a real static-widget
// sample for the byte-identity check below.
const STATIC_WIDGETS = ['widget-market-context', 'widget-dealer-flow-projection'] as const;

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
    // `gamma_flip: 253` is DELIBERATELY DIFFERENT from the bundle's `market_state.gamma_flip`
    // (248, fixture above) — criterion 14's mutation proof needs the two sources distinguishable
    // by VALUE, or a reintroduced `?? m.gamma_flip` fallback renders the same number by
    // coincidence and this test cannot catch it (the exact vacuity trap SPEC §7/criterion 57 exist
    // to forbid).
    pushLive({ live: true, mid: 251, gamma_flip: 253, last_trade: 251.13 });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('TSLA · $251.00');
    expect(screen.getByTestId('last-trade')).toHaveTextContent('Last trade $251.13');

    // Capture the static reads BEFORE the drop (byte-identity is the invariant).
    const staticBefore = STATIC_WIDGETS.map((id) => screen.getByTestId(id).textContent);

    // DROP: no payload for > STREAM_OFFLINE_MS → the payload-gap watchdog fires.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });

    // Live tiles degrade. FigureCell's pause mark is a real SVG icon, not the literal `⏸` glyph
    // (curvature-v2-foundations SPEC §4.1/§4.2 Icons row) — assert the icon's presence structurally
    // rather than a composed "⏸ offline" text node. (v2, SPEC §2.2 — owner ruling 2's debt) the
    // retention latch now owns Net flow / Spread / Gamma flip alike: each retains the last value
    // that actually arrived ON THE STREAM before the drop, so all three take the RETAINED arm
    // (F4, dimmed, `offline · last known`) because the live push above carried a value for each
    // (AC-17a/AC-17b, criterion 12).
    const liveTape = screen.getByTestId('live-tape');
    expect(within(liveTape).getAllByTestId('PauseIcon').length).toBeGreaterThan(0);
    const netFlowCell = screen.getByText('Net flow (5m)').closest('[data-figure-state]');
    expect(netFlowCell).toHaveAttribute('data-figure-state', 'offline-retained');
    expect(within(netFlowCell as HTMLElement).getByText('+1,200')).toBeInTheDocument();
    expect(
      within(netFlowCell as HTMLElement).getByText('offline · last known'),
    ).toBeInTheDocument();
    const spreadCell = screen.getByText('Spread').closest('[data-figure-state]');
    expect(spreadCell).toHaveAttribute('data-figure-state', 'offline-retained');
    expect(within(spreadCell as HTMLElement).getByText('$0.05')).toBeInTheDocument();
    // (v2) The label names the DERIVATION, not the connection state (criterion 18) — it is
    // `Gamma flip · live` before AND after the drop; the ladder's own `Gamma flip` row (FE-5) is a
    // separate, dotless figure and this label is deliberately never byte-identical to it.
    const gammaFlipCell = screen.getByText('Gamma flip · live').closest('[data-figure-state]');
    expect(gammaFlipCell).toHaveAttribute('data-figure-state', 'offline-retained');
    expect(
      within(gammaFlipCell as HTMLElement).getByText('offline · last known'),
    ).toBeInTheDocument();
    // The RETAINED value is the STREAM's $253, never the bundle's $248 (criterion 14) — this is
    // the assertion the mutation proof actually keys on.
    expect(within(gammaFlipCell as HTMLElement).getByText('$253')).toBeInTheDocument();
    expect(within(gammaFlipCell as HTMLElement).queryByText('$248')).toBeNull();
    expect(screen.getByTestId('last-trade')).toHaveTextContent('⏸ Last trade $251.13');
    // The connection chip's offline label no longer carries the literal `⚠` (curvature-v2-foundations
    // SPEC §4.2 Icons row — a real stroke warn icon renders instead) and asserts the resolved state
    // directly rather than a composed text node.
    expect(screen.getByTestId('connection-chip')).toHaveAttribute(
      'data-connection-state',
      'offline',
    );
    expect(screen.getByText('Live offline — reconnecting…')).toBeInTheDocument();

    // Statics keep rendering the last bundle, byte-identical, with NO offline look of their own.
    STATIC_WIDGETS.forEach((id, i) => {
      const w = screen.getByTestId(id);
      expect(w.textContent).toBe(staticBefore[i]);
      expect(within(w).queryByText(/⏸/)).toBeNull();
    });
    // (curvature-v2-desk-and-read FE-11) `GexStrikeProfile` is deleted — `StructureHeroPanel` is the
    // desk's ONE structure instrument now; this checks the successor stays mounted through the drop.
    expect(screen.getByTestId('widget-structure-hero')).toBeInTheDocument();
    expect(within(screen.getByTestId('level-ladder')).getByText('$260')).toBeInTheDocument(); // call wall value intact
    // OFFLINE is neither the cold skeleton nor a refresh/error state (3 distinct states).
    expect(screen.queryByTestId('cold-skeleton')).toBeNull();
    expect(screen.queryByText(/Couldn't refresh/)).toBeNull();
    expect(screen.queryByText('Retry')).toBeNull();

    // RECONNECT: the next payload clears offline; the live look returns; statics unmoved.
    pushLive({ live: true, mid: 251, gamma_flip: 248, last_trade: 251.55 });
    expect(screen.getByTestId('last-trade')).toHaveTextContent('● Last trade $251.55');
    expect(screen.queryByText('Live offline — reconnecting…')).toBeNull();
    expect(screen.getByTestId('connection-chip')).not.toHaveAttribute(
      'data-connection-state',
      'offline',
    );
    STATIC_WIDGETS.forEach((id, i) =>
      expect(screen.getByTestId(id).textContent).toBe(staticBefore[i]),
    );

    // POST-SUCCESS REFRESH FAILURE: the next poll 500s → soft warning, bundle KEPT, no error page.
    tickerOk = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    await screen.findByText(/Couldn't refresh/);
    expect(screen.getByText('Call wall')).toBeInTheDocument();
    STATIC_WIDGETS.forEach((id, i) =>
      expect(screen.getByTestId(id).textContent).toBe(staticBefore[i]),
    );
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
// 2b. Cold-load skeleton takes the v2 desk's FINAL SHAPE (AC-46 · fidelity repair 2, N1)
//
// The retired v1 skeleton (twelve identical tiles in a fluid grid, under a 280px title bar) is
// replaced by shimmer shaped like the real, already-built v2 desk: masthead → structure hero (field
// beside a five-row ladder column) → read strip (eight cells) → work grid (AI-brief + three side
// cards) → the band header. jsdom cannot lay out `@container`/media-query wrap (`Widget.spec.tsx`'s
// own note) — RESPONSIVE shape is verified by reading the emitted CSS rule text (the SAME
// `emotionClassOf`/`allRulesForClass`/`joinedStyleText` idiom `ReadStrip.spec.tsx` and
// `FigureCell.spec.tsx` already established for this exact class of assertion), never by resizing a
// real viewport.
// =================================================================================================
describe('Ticker · cold-load skeleton takes the desk’s final shape (AC-46, fidelity repair 2 N1)', () => {
  it('RED (a) — the hero-shaped skeleton is ≥400px tall at the base/wide rule, and pins a taller under-1000px-container height for the ladder-below-field shape', async () => {
    tickerDeferred = true;
    renderAt('/ticker/TSLA');
    const cold = await screen.findByTestId('cold-load');

    const hero = within(cold).getByTestId('cold-load-hero');
    // MUTATION GUARD — `cold-load-hero` (`SkeletonPanel`) must itself ESTABLISH the `panel`
    // container name; a query placed on this SAME element (rather than a descendant) would never
    // match at any width — a real-browser-only regression (jsdom never lays out `@container`) a
    // prior version of this fix shipped: the hero measured 483px at 390px instead of 968px because
    // the `down(1000)` override sat on the container-establishing element itself.
    const heroCls = emotionClassOf(hero);
    expect(heroCls).toBeTruthy();
    const heroRules = allRulesForClass(joinedStyleText(), heroCls as string)
      .join(';')
      .replace(/\s+/g, '');
    expect(heroRules).toContain('container-type:inline-size');
    expect(heroRules).toContain('container-name:panel');

    const grid = within(hero).getByTestId('cold-load-hero-grid');
    const cls = emotionClassOf(grid);
    expect(cls).toBeTruthy();
    const rules = allRulesForClass(joinedStyleText(), cls as string)
      .join(';')
      .replace(/\s+/g, '');

    const base = rules.match(/min-height:(\d+)px/);
    expect(base).not.toBeNull();
    expect(Number(base?.[1])).toBeGreaterThanOrEqual(400);

    // MUTATION GUARD — the narrow-container height is GATED behind `@container panel`, never a bare
    // `@media` (the container-query hazard `ReadStrip.tsx`'s own doc comment names).
    const squashed = joinedStyleText().replace(/\s+/g, '');
    expect(squashed).toContain('@containerpanel(max-width:999.95px)');
    expect(rules).toContain('min-height:968px');
  });

  it('RED (a) — at 1280 the cold-load subtree contains exactly eight read-strip skeleton cells', async () => {
    tickerDeferred = true;
    renderAt('/ticker/TSLA');
    const cold = await screen.findByTestId('cold-load');
    const strip = within(cold).getByTestId('cold-load-strip');
    expect(within(strip).getAllByTestId('cold-load-strip-cell')).toHaveLength(8);
  });

  it('the read-strip skeleton rail switches rail→grid behind the SAME `panel` container the hero uses (mutation guard, matching the hero’s own fix)', async () => {
    tickerDeferred = true;
    renderAt('/ticker/TSLA');
    const cold = await screen.findByTestId('cold-load');
    const strip = within(cold).getByTestId('cold-load-strip');
    const stripCls = emotionClassOf(strip);
    expect(stripCls).toBeTruthy();
    const stripRules = allRulesForClass(joinedStyleText(), stripCls as string)
      .join(';')
      .replace(/\s+/g, '');
    expect(stripRules).toContain('container-type:inline-size');
    expect(stripRules).toContain('container-name:panel');

    const rail = within(strip).getByTestId('cold-load-strip-rail');
    const railCls = emotionClassOf(rail);
    expect(railCls).toBeTruthy();
    const railRules = allRulesForClass(joinedStyleText(), railCls as string)
      .join(';')
      .replace(/\s+/g, '');
    expect(railRules).toContain('display:flex');
    expect(railRules).toContain('grid-template-columns:1.35frrepeat(7,minmax(0,1fr))');
    const squashed = joinedStyleText().replace(/\s+/g, '');
    expect(squashed).toContain('@containerpanel(min-width:1000px)');
  });

  it('RED (b) — the ladder skeleton sits below the field skeleton in document order (the single-column, under-1000px shape)', async () => {
    tickerDeferred = true;
    renderAt('/ticker/TSLA');
    const cold = await screen.findByTestId('cold-load');
    const hero = within(cold).getByTestId('cold-load-hero');
    const field = within(hero).getByTestId('cold-load-hero-field');
    const ladder = within(hero).getByTestId('cold-load-hero-ladder');
    // Field precedes ladder in the DOM; combined with the previous test's proof that the grid
    // collapses to a single `1fr` column under a 1000px container, single-column flow places the
    // ladder BELOW the field, never beside it, at narrow widths.
    expect(field.compareDocumentPosition(ladder) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('RED (c) — the existing absence-after-load assertion still passes: cold-skeleton and cold-load are both gone once the bundle resolves', async () => {
    tickerDeferred = true;
    renderAt('/ticker/TSLA');
    await screen.findByTestId('cold-load');
    await act(async () => {
      resolveTicker?.(richBundle());
    });
    await screen.findByText('Call wall');
    expect(screen.queryByTestId('cold-skeleton')).toBeNull();
    expect(screen.queryByTestId('cold-load')).toBeNull();
  });

  it('RED (d) — no text node inside cold-load before any data or live tick arrives (shimmer only, foundations F2)', async () => {
    tickerDeferred = true;
    renderAt('/ticker/TSLA');
    const cold = await screen.findByTestId('cold-load');
    // `textContent` concatenates every descendant text node; MUI `Skeleton` renders none (no
    // `children`) — a non-empty, non-whitespace string here means a stray label, `—`, or
    // "Loading…" crept in, which the design's shimmer-only frame forbids.
    expect((cold.textContent ?? '').trim()).toBe('');
  });

  it('the masthead skeleton is bare on the ink — no raised toolbar panel — behind the four v2 bands (chip row, headline, meta line, quick row)', async () => {
    tickerDeferred = true;
    renderAt('/ticker/TSLA');
    const cold = await screen.findByTestId('cold-load');
    const masthead = within(cold).getByTestId('cold-load-masthead');
    const cls = emotionClassOf(masthead);
    expect(cls).toBeTruthy();
    const rules = allRulesForClass(joinedStyleText(), cls as string).join(';');
    expect(rules).not.toContain('border');
    expect(rules).not.toContain('box-shadow');
  });
});

// =================================================================================================
// 3. Independent nullability — the null matrix (best-effort-isolated-or-null)
// =================================================================================================
// PASS 2 change 8: `iv_rank` dropped from this matrix — `IvRank` no longer renders on `/ticker` (its
// card left the context band, owner ruling `context-band-is-the-designs-card-list`), so nulling
// `market_state.iv_rank` no longer has an "IvRank empty copy" to observe on this page. The read
// strip's own IV-rank cell is a separate, still-mounted consumer, untouched by this pass, and isn't
// part of this best-effort-isolated-or-null matrix (it was never in this list before either).
// =================================================================================================
// 2c. Cold-start failure reads like the design, not a raw client status (fidelity repair 2, N7)
// =================================================================================================
describe('Ticker · cold-start failure reads like the design (fidelity repair 2, N7)', () => {
  it('a bundle that never arrives shows the design’s headline + body + Retry + an HTTP status detail line — never the raw client error string', async () => {
    tickerOk = false;
    renderAt('/ticker/TSLA');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load TSLA.");
    expect(alert).toHaveTextContent(
      'The structure request failed before any snapshot arrived. Nothing is cached for this desk yet.',
    );
    expect(alert.textContent ?? '').not.toContain('API error 500');
    expect(screen.getByText('Retry')).toBeInTheDocument();
    // The status is kept, not hidden — as a Mono detail line (design note), just never the bare
    // client string.
    expect(alert).toHaveTextContent('HTTP 500');
  });

  it('the toolbar stays usable during the failure', async () => {
    tickerOk = false;
    renderAt('/ticker/TSLA');
    await screen.findByRole('alert');
    expect(screen.getByTestId('ticker-toolbar')).toBeInTheDocument();
  });
});

// =================================================================================================
// 2d. no-vendor-production-posture F2/F2b — the paused cold-start panel is NOT the warning panel
// =================================================================================================
describe('Ticker · market data paused (no-vendor-production-posture F2/F2b)', () => {
  it('AC-6: the byte-exact info panel — role=status, no Retry, no HTTP line — and zero further /api/ticker calls for 60s+', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    tickerPaused = true;
    renderAt('/ticker/TSLA');

    const panel = await screen.findByRole('status');
    expect(panel).toHaveTextContent('Market data is paused.');
    expect(panel).toHaveTextContent(
      'Convexa isn’t connected to a market-data feed right now, so this desk can’t load prices or ' +
        'dealer structure. Nothing is broken, and retrying won’t change it.',
    );
    expect(screen.queryByRole('alert')).toBeNull(); // never the warning-severity panel too
    expect(screen.queryByText('Retry')).toBeNull();
    expect(panel.textContent ?? '').not.toMatch(/HTTP \d{3}/);
    expect(screen.getByRole('link', { name: 'How the desk reads structure →' })).toHaveAttribute(
      'href',
      '/methodology',
    );
    expect(screen.getByRole('link', { name: 'See an illustrative sample →' })).toHaveAttribute(
      'href',
      '/#landing-sample-field',
    );

    const tickerCalls = () =>
      fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/ticker/')).length;
    expect(tickerCalls()).toBe(1); // the one request that discovered paused

    await act(async () => {
      await vi.advanceTimersByTimeAsync(65_000); // > the 60s bundle poll cadence
    });
    expect(tickerCalls()).toBe(1); // F2b — no poll, no auto-retry, ever, for this ticker

    // The visibility-resume path is ALSO a trigger `usePollingResource` normally honors — must stay
    // inert once paused, exactly like the interval.
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(tickerCalls()).toBe(1);
  });

  it('the toolbar stays usable while paused (the trader can still change ticker/expirations)', async () => {
    tickerPaused = true;
    renderAt('/ticker/TSLA');
    await screen.findByRole('status');
    expect(screen.getByTestId('ticker-toolbar')).toBeInTheDocument();
  });
});

const NULLABLE_SECTIONS: Array<[field: string, emptyCopy: string]> = [
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
      // (v2, FE-8) walls live in the ladder now; the score lives in the read strip's opportunity
      // cell — two separate successors of the old dealer positioning widget's single container
      // (deleted at FE-8).
      expect(within(screen.getByTestId('level-ladder')).getByText('$260')).toBeInTheDocument();
      expect(
        within(screen.getByTestId('read-strip-cell-opportunity')).getByText(/42 ·/),
      ).toBeInTheDocument();
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
    expect(within(screen.getByTestId('level-ladder')).getByText('$260')).toBeInTheDocument();
    expect(screen.queryByText('Retry')).toBeNull();
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

// =================================================================================================
// 4. Wire-label authority — labels come from the wire via closed lookups, NEVER re-derived
// =================================================================================================
describe('Ticker · wire-label authority (digested-labels-not-raw-dump)', () => {
  it('when a label CONTRADICTS its scalar, the LABEL wins (trend direction, term state, gamma regime)', async () => {
    const tmFix = PACK_FIX.trend_momentum;
    const dirFix = tmFix?.direction;
    if (!tmFix || !dirFix) throw new Error('PACK_FIX fixture must carry trend_momentum.direction');
    bundleProvider = () =>
      richBundle(
        {
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

    // PASS 2 change 8: the iv-rank-band example (`widget-iv-rank`'s `ivr-band` testid) dropped —
    // `IvRank` no longer mounts on `/ticker` (owner ruling `context-band-is-the-designs-card-list`).
    // The invariant (wire label wins over a scalar-derived alternative) stays covered by the three
    // remaining examples below; `IvRank.spec.tsx`'s own suite (component stays, unmount only) still
    // covers this same label-authority behavior for the widget itself, in isolation.

    // Trend direction: the wire label renders; nothing re-derives "Uptrend" from the EMAs.
    const mc = screen.getByTestId('widget-market-context');
    expect(within(mc).getByText('Downtrend')).toBeInTheDocument();
    expect(within(mc).queryByText('Uptrend')).toBeNull();

    // Term-structure state: the wire state renders despite inverted IVs.
    // Subtitle may also carry structure age (spine #4) — match the label, not the full string.
    expect(screen.getByText(/ATM IV by tenor · contango/)).toBeInTheDocument();

    // Gamma regime chip: the wire regime renders despite a positive net_gex.
    expect(screen.getByText('negative gamma')).toBeInTheDocument();
  });
});

// =================================================================================================
// 5. Model-read self-description — the basis/assumption line rides WITH its value
// =================================================================================================
describe('Ticker · model-read self-description', () => {
  it('the projection horizon renders alongside its value', async () => {
    renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');

    // PASS 2 change 8: the iv-rank half of this pairing test dropped — `widget-iv-rank` no longer
    // mounts on `/ticker` (owner ruling `context-band-is-the-designs-card-list`). The invariant
    // (`model-read-carries-its-assumptions`) is still exercised below via dealer-flow-projection,
    // AND moved to `iv-rank/IvRank.spec.tsx` (component-level) for the rank-value/basis pairing.

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
    expect(within(screen.getByTestId('level-ladder')).getByText('$260')).toBeInTheDocument();

    // No recent print → the honest empty, NEVER the prior value styled current; anchor unmoved.
    pushLive({ live: true, mid: 251, gamma_flip: 248, last_trade: null });
    const lt = screen.getByTestId('last-trade');
    expect(lt).toHaveTextContent('no recent print');
    expect(lt).not.toHaveTextContent('999.99');
    expect(lt).not.toHaveTextContent('251.13');
    expect(anchor()).toHaveTextContent('TSLA · $251.00');
  });
});

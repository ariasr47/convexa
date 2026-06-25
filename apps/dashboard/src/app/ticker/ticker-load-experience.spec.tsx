/**
 * ticker-load-experience — COMPONENT-STATE tests (the C-kind rows of the FRONTEND_EXECUTION_CONTRACT
 * §6 "Tests to write" matrix). Each test is named for the AC it traces (QA enforces AC↔test at GATE Q).
 *
 * Mounts the REAL ticker subtree via the route table, mocking ONLY the network boundary (`fetch` + a
 * controllable `EventSource`). NEVER a live backend. The flow-integration (F) rows live in the
 * centerpiece `ticker-load-experience.flow.spec.tsx`.
 *
 * Component states asserted (UX_BLUEPRINT §2 taxonomy, never conflated):
 *   LOADING (cold skeleton) · EMPTY ("unavailable this cycle") · STALE · OFFLINE · ERROR · LIVE-EMPTY.
 *
 * AC coverage (C): Skel-1, Skel-3, Skel-4, Skel-5, State-1, State-2, State-3, Isolation-2,
 *   LastTrade-1, LastTrade-2, LastTrade-3, LastTrade-4, LastTrade-5, Stale-1, Stale-2, Invariant-3.
 */
import { render, screen, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import type { TickerBundle, LiveUpdate } from '@org/api';

import App from '../app';
import { theme } from '../theme';
import { __resetMemory } from '../positions/store';

// ---- Mock-boundary fixtures ----------------------------------------------------------------
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
    ai_eval: { ready: false, reasons: [], changed: false, state_fingerprint: 'x', score_threshold: 60 },
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
let tickerOk = true;
let hangTicker = false; // when true, the bundle fetch never resolves (cold-LOADING under inspection)
let bundleOverride: (() => TickerBundle) | null = null;
let fetchMock: ReturnType<typeof vi.fn>;

function pushLive(over: Partial<LiveUpdate> = {}) {
  act(() => { esInstances.forEach((es) => es.onmessage?.({ data: JSON.stringify(liveUpdate(over)) } as MessageEvent)); });
}

// The single mock-boundary handler. `hangTicker`/`tickerOk`/`bundleOverride` are mutable knobs so a
// test can switch cold→loaded WITHOUT permanently clobbering the impl (the source of cross-render leaks).
async function handleFetch(input: RequestInfo | URL): Promise<Response> {
  const url = String(input);
  const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } });
  if (url.includes('/api/ticker/')) {
    if (hangTicker) return new Promise<Response>(() => { /* never resolves */ });
    if (!tickerOk) return new Response('error', { status: 500 });
    return json(bundleOverride ? bundleOverride() : makeBundle());
  }
  if (url.includes('/api/recommendation/status/')) {
    return json({ availability: { in_app_enabled: true }, gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] }, cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-24T04:00:00Z' } });
  }
  if (url.includes('/api/personas')) return json([{ id: 'default', name: 'Default (no persona)' }]);
  if (url.includes('/api/contract/')) return json(null);
  throw new Error(`Unexpected fetch in test: ${url}`);
}

beforeEach(() => {
  localStorage.clear();
  __resetMemory();
  esInstances = [];
  tickerOk = true;
  hangTicker = false;
  bundleOverride = null;

  class MockEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    closed = false;
    constructor() { esInstances.push(this as unknown as MockES); }
    close() { this.closed = true; }
  }
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);

  fetchMock = vi.fn(handleFetch);
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
describe('ticker-load-experience — skeleton-first load (component states)', () => {
  it('cold load paints page structure with no full-page spinner', async () => {
    // AC-Skel-1: cold load (no bundle yet, no error) → structure paints as shimmer; NO body spinner.
    hangTicker = true;
    renderAt('/ticker/TSLA');

    // The cold-load structure is present (the page is not blank), with tile skeletons laid out.
    const cold = await screen.findByTestId('cold-load');
    expect(cold).toBeInTheDocument();
    expect(within(cold).getAllByTestId('cold-skeleton').length).toBeGreaterThan(0);
    // There is NO full-page CircularProgress gating the body (the removed monolithic gate). The only
    // role="progressbar" that may exist is the small inline toolbar refresh spinner — assert no
    // progressbar lives inside the cold-load body region.
    expect(within(cold).queryByRole('progressbar')).toBeNull();
  });

  it('cold skeleton is visually distinct from unavailable-this-cycle', async () => {
    // AC-Skel-3: LOADING (shimmer, data-testid=cold-skeleton) ≠ EMPTY (resolved-null muted text).
    // Cold first: the shimmer skeleton is present and the resolved-empty copy is NOT.
    hangTicker = true;
    const { unmount } = renderAt('/ticker/TSLA');
    const cold = await screen.findByTestId('cold-load');
    expect(within(cold).getAllByTestId('cold-skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByText('Term structure unavailable this cycle.')).toBeNull();
    unmount();

    // Resolved-EMPTY: a loaded bundle with null term_structure shows the muted empty text, no shimmer.
    hangTicker = false;
    bundleOverride = () => makeBundle({ term_structure: null });
    renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');
    expect(screen.getByText('Term structure unavailable this cycle.')).toBeInTheDocument();
    expect(screen.queryByTestId('cold-skeleton')).toBeNull(); // skeleton class gone once loaded
  });

  it('cold skeleton is visually distinct from live-feed-dropped', async () => {
    // AC-Skel-4: LOADING (shimmer, pre-load) ≠ OFFLINE (loaded then dropped → real values dimmed +⏸).
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');
    // Once loaded, the cold skeleton class is GONE — it never appears post-load.
    expect(screen.queryByTestId('cold-skeleton')).toBeNull();

    // Drop the live feed → OFFLINE: the `⏸ offline` caption + the connection chip appear; the offline
    // dim is a different look from the (now-absent) cold skeleton.
    pushLive({ live: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(16_000); });
    expect(screen.getAllByText('⏸ offline').length).toBeGreaterThan(0);
    expect(screen.getByText('⚠ Live offline — reconnecting…')).toBeInTheDocument();
    expect(screen.queryByTestId('cold-skeleton')).toBeNull(); // OFFLINE is not the cold skeleton
  });

  it('resolved-empty source shows empty state, not a stuck skeleton', async () => {
    // AC-Skel-5: a source resolving to null/[] shows its EMPTY copy and clears the skeleton (no
    // perpetual shimmer). Bundle present but off_exchange/term/vol-oi nulled.
    bundleOverride = () => {
      const b = makeBundle({ term_structure: null, chain_vol_oi_ratio: null });
      return { ...b, off_exchange: undefined };
    };
    renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');
    expect(screen.getByText('Off-exchange data unavailable this cycle.')).toBeInTheDocument();
    expect(screen.getByText('Vol/OI unavailable this cycle.')).toBeInTheDocument();
    expect(screen.getByText('Term structure unavailable this cycle.')).toBeInTheDocument();
    expect(screen.queryByTestId('cold-skeleton')).toBeNull(); // not stuck in a skeleton
  });
});

// ============================================================================================
describe('ticker-load-experience — the four post-load states (preserved)', () => {
  it('failed refresh after success keeps last bundle behind soft notice', async () => {
    // AC-State-1: STALE — a poll failure after a prior success keeps the bundle, soft warning, no blank.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');

    // Next poll fails → the bundle stays; a soft "Couldn't refresh" warning appears; nothing blanks.
    tickerOk = false;
    await act(async () => { await vi.advanceTimersByTimeAsync(61_000); });
    expect(screen.getByText(/Couldn't refresh/)).toBeInTheDocument();
    expect(screen.getByText('Call wall')).toBeInTheDocument(); // last good bundle still on screen
    expect(screen.queryByText('Retry')).toBeNull();            // not the cold-start error screen
  });

  it('live-feed drop dims only live tiles, statics keep last good values', async () => {
    // AC-State-2: OFFLINE — only live-derived tiles dim (⏸); statics (Call wall) keep last good values.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');
    pushLive({ live: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(16_000); });

    expect(screen.getAllByText('⏸ offline').length).toBeGreaterThan(0); // live tiles dimmed
    expect(screen.getByText('Call wall')).toBeInTheDocument();           // static read intact
    expect(screen.getByText('$260')).toBeInTheDocument();                // its value intact
  });

  it('first-load failure shows single error + retry as the only blank screen', async () => {
    // AC-State-3: ERROR — first load fails with nothing yet → single red error + Retry; only blank.
    tickerOk = false;
    renderAt('/ticker/TSLA');
    expect(await screen.findByText('Retry')).toBeInTheDocument();
    // No cold skeleton left spinning, no other content.
    expect(screen.queryByTestId('cold-load')).toBeNull();
    expect(screen.queryByText('Call wall')).toBeNull();
  });
});

// ============================================================================================
describe('ticker-load-experience — best-effort isolation (component)', () => {
  it('single source failure shows only that component empty, rest loads', async () => {
    // AC-Isolation-2: one source (off_exchange) fails → only its "unavailable" copy; the rest loads.
    bundleOverride = () => {
      const b = makeBundle();
      return { ...b, off_exchange: undefined };
    };
    renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');
    expect(screen.getByText('Off-exchange data unavailable this cycle.')).toBeInTheDocument();
    expect(screen.getByText('$260')).toBeInTheDocument(); // walls render
    expect(screen.getByText(/73 ·/)).toBeInTheDocument(); // score renders
  });
});

// ============================================================================================
describe('ticker-load-experience — live last-trade readout (component)', () => {
  it('last trade shows live print beside anchor and updates', async () => {
    // AC-LastTrade-1: DEFAULT — `● Last trade $X` beside the anchor; updates on the next payload.
    renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');
    pushLive({ live: true, last_trade: 251.13 });
    const lt = screen.getByTestId('last-trade');
    expect(lt).toHaveTextContent('Last trade $251.13');

    pushLive({ live: true, last_trade: 252.40 });
    expect(screen.getByTestId('last-trade')).toHaveTextContent('Last trade $252.40');
  });

  it('no recent print shows "no recent print", never a stale value', async () => {
    // AC-LastTrade-2: LIVE-EMPTY — a payload with last_trade:null shows the honest empty, never a
    // stale prior value styled current.
    renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');
    pushLive({ live: true, last_trade: 251.13 });
    expect(screen.getByTestId('last-trade')).toHaveTextContent('Last trade $251.13');

    // Next payload: no recent print → must NOT keep showing $251.13.
    pushLive({ live: true, last_trade: null });
    const lt = screen.getByTestId('last-trade');
    expect(lt).toHaveTextContent('no recent print');
    expect(lt).not.toHaveTextContent('251.13');
  });

  it('last trade dims and pauses with live fields on drop, recovers on reconnect', async () => {
    // AC-LastTrade-3: OFFLINE last-trade — dims (⏸) with the other live tiles on a drop; recovers.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');
    pushLive({ live: true, last_trade: 251.13 });
    await act(async () => { await vi.advanceTimersByTimeAsync(16_000); }); // drop

    const lt = screen.getByTestId('last-trade');
    expect(lt).toHaveTextContent('⏸ Last trade $251.13'); // paused, last-known, dimmed
    expect(screen.getByText('⚠ Live offline — reconnecting…')).toBeInTheDocument();

    // Reconnect: a new payload clears offline; the readout returns to the live look.
    pushLive({ live: true, last_trade: 251.55 });
    expect(screen.getByTestId('last-trade')).toHaveTextContent('● Last trade $251.55');
    expect(screen.queryByText('⚠ Live offline — reconnecting…')).toBeNull();
  });

  it('last trade is secondary and never presented as the headline', async () => {
    // AC-LastTrade-4: the readout is body2 (secondary), never the h1 headline.
    renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');
    pushLive({ live: true, last_trade: 251.13 });
    const lt = screen.getByTestId('last-trade');
    // The headline anchor is the h1; the last-trade is not it.
    const headline = screen.getByRole('heading', { level: 1 });
    expect(headline).not.toContainElement(lt);
    expect(headline).not.toHaveTextContent('Last trade');
  });

  it('changing or clearing last trade never moves headline, levels, or flip', async () => {
    // AC-LastTrade-5 (BINDING): last_trade is display-only — it never moves the anchor/levels/flip.
    renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');
    // Live: anchor = mid 251, flip = live gamma_flip 248, walls static.
    pushLive({ live: true, mid: 251, gamma_flip: 248, last_trade: 251.13 });
    const headline = screen.getByRole('heading', { level: 1 });
    expect(headline).toHaveTextContent('TSLA · $251.00');
    expect(screen.getByText('$248')).toBeInTheDocument();  // gamma flip
    expect(screen.getByText('$260')).toBeInTheDocument();  // call wall

    // Now change last_trade wildly and clear it; the mid/flip/walls must be UNMOVED.
    pushLive({ live: true, mid: 251, gamma_flip: 248, last_trade: 999.99 });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('TSLA · $251.00');
    expect(screen.getByText('$248')).toBeInTheDocument();
    pushLive({ live: true, mid: 251, gamma_flip: 248, last_trade: null });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('TSLA · $251.00');
    expect(screen.getByText('$248')).toBeInTheDocument();
    expect(screen.getByText('$260')).toBeInTheDocument();
  });
});

// ============================================================================================
describe('ticker-load-experience — stale-warning honesty + isolation', () => {
  it('stale warning does not fire mid-session under real-time threshold', async () => {
    // AC-Stale-1: freshness within threshold (stale:false) → no "levels may be unreliable" warning.
    bundleOverride = () => {
      const b = makeBundle();
      return { ...b, meta: { ...b.meta, freshness: { ...b.meta.freshness, stale: false, data_age_seconds: 45 } } };
    };
    renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');
    expect(screen.queryByText(/levels may be unreliable/)).toBeNull();
  });

  it('stale warning still fires when data is genuinely old', async () => {
    // AC-Stale-2: genuinely old freshness (stale:true) → the honest warning still fires.
    bundleOverride = () => {
      const b = makeBundle();
      return { ...b, meta: { ...b.meta, freshness: { ...b.meta.freshness, stale: true, data_age_seconds: 242779 } } };
    };
    renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');
    expect(screen.getByText(/levels may be unreliable/)).toBeInTheDocument();
  });

  it('live-vs-static isolation: last trade degrades live while statics persist', async () => {
    // AC-Invariant-3: last-trade is live-class (degrades on drop), statics keep the last bundle; the
    // LOADING / OFFLINE / STALE looks are never conflated.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');
    expect(screen.queryByTestId('cold-skeleton')).toBeNull(); // LOADING look gone post-load

    pushLive({ live: true, last_trade: 251.13 });
    await act(async () => { await vi.advanceTimersByTimeAsync(16_000); }); // OFFLINE

    // Last-trade dimmed/paused WITH the live tiles; the static walls keep their last good value.
    expect(screen.getByTestId('last-trade')).toHaveTextContent('⏸ Last trade $251.13');
    expect(screen.getByText('Call wall')).toBeInTheDocument();
    expect(screen.getByText('$260')).toBeInTheDocument();
    // OFFLINE is not the cold skeleton and not a refresh notice.
    expect(screen.queryByTestId('cold-skeleton')).toBeNull();
    expect(screen.queryByText(/Couldn't refresh/)).toBeNull();
  });
});

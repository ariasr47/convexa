/**
 * CommandDeck — component + unit tests for the unified Ticker command deck (ticker-command-deck plan).
 *
 * The end-to-end user-flow coverage (cold-load → live → drop → reconnect, freshness "Updated…",
 * last-trade 4 states, expirations all→null/subset/none, symbol submit) lives in the App-mounted
 * centerpiece specs (`ticker-load-experience(.flow).spec.tsx`, `ticker-invariants.spec.tsx`), which now
 * drive the deck through the real subtree. This spec asserts the deck's OWN structure + the behaviors
 * that moved into it:
 *   - the deck renders as ONE cohesive chrome panel composing the hero + the segmented control strip
 *     + the hand-off (not three separate zones);
 *   - the meta line FOLDS the last-trade readout + the relocated freshness ("Updated Ns ago");
 *   - the control strip is ONE segmented container (`ticker-toolbar`) — symbol submit (Enter),
 *     Expirations all→null / subset / none, Persona pick;
 *   - the `+ Open simulated trade` CTA fires;
 *   - `connectionChip` (unit) resolves the SINGLE stream-driven chip — live / stale / offline, with the
 *     offline supersede + the live-only pulse;
 *   - the sticky condensed bar reveals when the deck scrolls out and its price + connection FREEZE on an
 *     SSE drop (`[live-vs-static-isolation]`), never a stale "live"; reduced-motion → no transition.
 */
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import type { LiveUpdate, MarketState, Signals } from '@org/api';
import { theme } from '../../theme';
import { __resetMemory } from '../../positions/store';
import { CommandDeck } from './CommandDeck';
import { connectionChip } from './TickerHeader';
import { usePersona } from '../../personas/usePersona';

// ---- Fixtures --------------------------------------------------------------------------------
function marketState(over: Partial<MarketState> = {}): MarketState {
  return {
    ticker: 'TSLA', price: 415.99, gex_spot: 410, timestamp: 1, timestamp_iso: '2026-06-23T14:30:00Z',
    call_wall: 430, put_wall: 400, peak_gex_strike: 420, gamma_flip: 408, max_pain: 415,
    max_pain_expiration: '2026-06-26', net_gex: 1.2e9, call_gex: 2.0e9, put_gex: -0.8e9, total_gex: 1.2e9,
    net_dex: 5.0e8, call_dex: 6.0e8, put_dex: -1.0e8, net_vanna: null, net_charm: null, net_volga: null,
    vwap: 414, vwap_upper_2: null, vwap_upper_3: null, vwap_lower_2: null, vwap_lower_3: null,
    dte_min: null, dte_max: null, atm_iv: 45, hv_30d: 40, iv_hv_ratio: 1.12, net_flow: null,
    put_call_ratio: 0.8, chain_vol_oi_ratio: 0.5, total_volume: 100_000, vol_oi_unusual_threshold: 1,
    iv_skew: null, term_structure: null, dealer_flow_projection: null, ...over,
  } as MarketState;
}
const signals: Signals = {
  ticker: 'TSLA', regime: 'positive_gamma', regime_note: null, vol_regime: 'neutral', distances: {},
  setups: [], opportunity_score: 73, opportunity_tier: 'actionable', prime_prompt_eligible: false,
} as Signals;

function liveUpdate(over: Partial<LiveUpdate> = {}): LiveUpdate {
  return {
    ticker: 'TSLA', mid: 416.5, bid: null, ask: null, spread: 0.05, net_flow: 1200, buy_vol: 0, sell_vol: 0,
    flow_window_s: 300, spot_ts: 1, live: true, tick_age_s: 1, market_session: 'regular', feed: 'realtime',
    ts: Date.now(), gamma_flip: 408, last_trade: 416.13, ...over,
  } as LiveUpdate;
}

// A harness that supplies the real `usePersona` (client-local, no network) to the deck, so the deck is
// exercised with its true persona wiring. Props override the deck inputs per test.
type DeckProps = React.ComponentProps<typeof CommandDeck>;
function Harness(props: Partial<DeckProps>) {
  const persona = usePersona();
  const base: DeckProps = {
    m: marketState(),
    sig: signals,
    live: null,
    isLive: false,
    streamOffline: false,
    selected: null,
    onOpenTrade: vi.fn(),
    freshness: { snapshotIso: '2026-06-23T14:30:00Z', dataAgeSeconds: 30, refreshing: false },
    symbol: 'TSLA',
    onSymbolChange: vi.fn(),
    onSubmitSymbol: vi.fn(),
    expirations: [
      { date: '2026-06-26', dte: 3 },
      { date: '2026-07-03', dte: 10 },
    ],
    allDates: ['2026-06-26', '2026-07-03'],
    checked: ['2026-06-26', '2026-07-03'],
    onSelectExpirations: vi.fn(),
    persona,
    onOpenCustomize: vi.fn(),
    loading: false,
    ...props,
  };
  return <CommandDeck {...base} />;
}

function renderDeck(props: Partial<DeckProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <Harness {...props} />
    </ThemeProvider>,
  );
}

// A controllable IntersectionObserver so a test can toggle the sticky condensed bar without a real
// scroll (jsdom has none). The most-recent instance's callback is captured.
let ioCallback: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
function installIntersectionObserver() {
  class MockIO {
    constructor(cb: (entries: { isIntersecting: boolean }[]) => void) { ioCallback = cb; }
    observe() { return undefined; }
    disconnect() { return undefined; }
    unobserve() { return undefined; }
  }
  vi.stubGlobal('IntersectionObserver', MockIO as unknown as typeof IntersectionObserver);
}
function scrollDeckOut() {
  act(() => { ioCallback?.([{ isIntersecting: false }]); }); // sentinel left viewport → condensed
}

beforeEach(() => {
  localStorage.clear();
  __resetMemory();
  ioCallback = null;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ============================================================================================
describe('CommandDeck — one cohesive chrome panel', () => {
  it('composes the hero + the segmented control strip + the hand-off in a single deck surface', () => {
    renderDeck();
    const deck = screen.getByTestId('command-deck');
    // The hero anchor (h1) and the control strip both live INSIDE the one deck panel.
    expect(within(deck).getByRole('heading', { level: 1 })).toHaveTextContent('TSLA · $415.99');
    expect(within(deck).getByTestId('ticker-toolbar')).toBeInTheDocument();
    // The hand-off gradient is present below the deck (decorative, aria-hidden).
    expect(screen.getByTestId('deck-handoff')).toBeInTheDocument();
  });

  it('folds the last-trade readout and the relocated freshness into one meta line', () => {
    renderDeck({
      live: liveUpdate({ live: true, last_trade: 416.13 }), isLive: true,
      freshness: { snapshotIso: null, dataAgeSeconds: 30, refreshing: false }, // fallback → deterministic
    });
    const meta = screen.getByTestId('deck-meta');
    expect(within(meta).getByTestId('last-trade')).toHaveTextContent('Last trade $416.13');
    expect(within(meta).getByTestId('freshness-line')).toHaveTextContent('Updated 30s ago');
  });

  it('shows the muted levels sub-line beside the anchor, all-expirations by default', () => {
    renderDeck();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('(levels @ $410.00 · all expirations)');
  });
});

// ============================================================================================
describe('CommandDeck — control strip (behaviors moved from the old toolbar)', () => {
  it('submits the symbol on Enter', async () => {
    const onSubmitSymbol = vi.fn();
    const user = userEvent.setup();
    renderDeck({ onSubmitSymbol });
    const input = screen.getByLabelText('Ticker');
    await user.click(input);
    await user.keyboard('{Enter}');
    expect(onSubmitSymbol).toHaveBeenCalledTimes(1);
  });

  it('uppercases symbol input', async () => {
    const onSymbolChange = vi.fn();
    const user = userEvent.setup();
    renderDeck({ symbol: '', onSymbolChange });
    await user.type(screen.getByLabelText('Ticker'), 'a');
    expect(onSymbolChange).toHaveBeenLastCalledWith('A');
  });

  it('Expirations: every date ticked → null (all, no filter)', async () => {
    // Start from a subset so ticking the last one reaches "all" → null.
    const onSelectExpirations = vi.fn();
    const user = userEvent.setup();
    renderDeck({ selected: ['2026-06-26'], checked: ['2026-06-26'], onSelectExpirations });
    await user.click(screen.getByLabelText('Expirations'));
    await user.click(screen.getByText('2026-07-03')); // tick the second → all ticked
    expect(onSelectExpirations).toHaveBeenLastCalledWith(null);
  });

  it('Expirations: a partial pick → the explicit subset', async () => {
    const onSelectExpirations = vi.fn();
    const user = userEvent.setup();
    renderDeck({ selected: null, checked: ['2026-06-26', '2026-07-03'], onSelectExpirations });
    await user.click(screen.getByLabelText('Expirations'));
    await user.click(screen.getByText('2026-07-03')); // untick one → subset of 1
    expect(onSelectExpirations).toHaveBeenLastCalledWith(['2026-06-26']);
  });

  it('Expirations: unticking all → [] (none selected)', async () => {
    const onSelectExpirations = vi.fn();
    const user = userEvent.setup();
    renderDeck({ selected: ['2026-06-26'], checked: ['2026-06-26'], onSelectExpirations });
    await user.click(screen.getByLabelText('Expirations'));
    await user.click(screen.getByText('2026-06-26')); // untick the only one → []
    expect(onSelectExpirations).toHaveBeenLastCalledWith([]);
  });

  it('picks a persona from the strip', async () => {
    const user = userEvent.setup();
    renderDeck();
    // The picker shows the active persona; opening + choosing another switches (client-local, no net).
    const picker = screen.getByLabelText('Persona');
    await user.click(picker);
    const option = await screen.findAllByRole('option');
    expect(option.length).toBeGreaterThan(1); // Default + presets + Customize…
  });

  it('fires the "+ Open simulated trade" CTA', async () => {
    const onOpenTrade = vi.fn();
    const user = userEvent.setup();
    renderDeck({ onOpenTrade });
    await user.click(screen.getByTestId('open-sim-trade'));
    expect(onOpenTrade).toHaveBeenCalledTimes(1);
  });

  it('shows the refresh spinner when loading', () => {
    renderDeck({ loading: true });
    expect(within(screen.getByTestId('ticker-toolbar')).getByRole('progressbar')).toBeInTheDocument();
  });
});

// ============================================================================================
describe('connectionChip — the single stream-driven connection chip (unit)', () => {
  it('live session → info tone, ● dot, pulses (motion allowed)', () => {
    const c = connectionChip(liveUpdate({ live: true, market_session: 'regular', mid: 416.5 }), false, false);
    expect(c?.tone).toBe('info');
    expect(c?.dot).toBe('●');
    expect(c?.pulse).toBe(true);
    expect(c?.text).toContain('live');
  });

  it('reduced motion → the live dot does not pulse', () => {
    const c = connectionChip(liveUpdate({ live: true }), false, true);
    expect(c?.pulse).toBe(false);
  });

  it('no live ticks in a covered session → warning tone, ○ dot, no pulse', () => {
    const c = connectionChip(liveUpdate({ live: false, market_session: 'regular', mid: 416.5 }), false, false);
    expect(c?.tone).toBe('warning');
    expect(c?.dot).toBe('○');
    expect(c?.pulse).toBe(false);
  });

  it('stream offline SUPERSEDES a would-be live session (never a stale "live")', () => {
    const c = connectionChip(liveUpdate({ live: true, market_session: 'regular' }), true, false);
    expect(c?.tone).toBe('warning');
    expect(c?.text).toContain('Live offline');
    expect(c?.pulse).toBe(false); // no pulse when offline
  });

  it('no live payload yet → no chip', () => {
    expect(connectionChip(null, false, false)).toBeNull();
  });
});

// ============================================================================================
describe('CommandDeck — sticky condensed bar (scroll-out + live isolation)', () => {
  it('is absent until the deck scrolls out, then reveals with the live-correct price + connection', () => {
    installIntersectionObserver();
    renderDeck({ live: liveUpdate({ live: true, mid: 416.5 }), isLive: true });
    // Not condensed initially — no sticky bar in the DOM.
    expect(screen.queryByTestId('deck-sticky')).toBeNull();

    scrollDeckOut();
    const sticky = screen.getByTestId('deck-sticky');
    // Live-correct: the anchor mirrors the live mid, the connection chip is the live one.
    expect(sticky).toHaveTextContent('TSLA · $416.50');
    expect(within(sticky).getByText(/live/)).toBeInTheDocument();
  });

  it('the sticky price + connection FREEZE on an SSE drop — never a stale "live"', () => {
    installIntersectionObserver();
    // Offline: the transport dropped. isLive is false; the sticky bar must show the STATIC price
    // (m.price) and the offline chip, not a stale live mid or a "live" chip.
    renderDeck({
      live: liveUpdate({ live: true, mid: 416.5 }), isLive: false, streamOffline: true,
    });
    scrollDeckOut();
    const sticky = screen.getByTestId('deck-sticky');
    expect(sticky).toHaveTextContent('TSLA · $415.99'); // static price, NOT the stale 416.50 live mid
    expect(within(sticky).getByText('⚠ Live offline — reconnecting…')).toBeInTheDocument();
    expect(within(sticky).queryByText(/● live/)).toBeNull();
  });

  it('reduced-motion → the condensed reveal uses no transition', () => {
    (window as unknown as { matchMedia?: unknown }).matchMedia = vi.fn().mockReturnValue({
      matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(),
    });
    installIntersectionObserver();
    renderDeck({ live: liveUpdate({ live: true }), isLive: true });
    scrollDeckOut();
    // The reveal wrapper flags reduced-motion, gating its transition to 'none' (no animated condense).
    expect(screen.getByTestId('deck-sticky-reveal')).toHaveAttribute('data-reduced', 'true');
    (window as unknown as { matchMedia?: unknown }).matchMedia = undefined;
  });
});

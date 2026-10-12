/**
 * CommandDeck — RISK-BASED spec (qa-verify.md §4, 2026-07-13). The App-mounted flow (cold-load → live
 * → drop → reconnect, last-trade states, freshness) lives in `pages/ticker/ticker.risk.spec.tsx`; this
 * spec keeps the deck's OWN invariants where a silent regression is plausible AND invisible:
 *   1. `connectionChip` (pure unit) — the not-this-ticker session-tape chip names the ARMED
 *      identity, never the route symbol.
 *   2. The sticky condensed bar, on an SSE drop, FREEZES to the STATIC price + offline chip — never
 *      the stale live mid styled current (`[live-vs-static-isolation]`).
 *   3. The Expirations tri-state WIRE semantics: all-ticked → null (no filter), a partial pick → the
 *      explicit subset, none → [] — a refactor sending the full list instead of null changes backend
 *      scoping with zero visible UI difference.
 * NOT asserted (visible + intentional → review/page): persona picker contents, CTA wiring, loading
 * spinner, reduced-motion transition styling.
 */
import { usePersona } from '@/features/personas/usePersona';
import { __resetMemory } from '@/features/trading/positions/store';
import { theme } from '@/shared/theme/theme';
import type { LiveUpdate, MarketState, Signals } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectionStateFor } from '../../connection/connectionState';
import { resolveChipContent } from '../../connection/copy';
import type { SessionTapeOccupancy } from '../../sessionTapeStanding';
import { CommandDeck } from './CommandDeck';

/**
 * Migrated off the deleted `TickerHeader.connectionChip()` (curvature-v2-foundations, SPEC §2.4:
 * "the resolver moves out of `TickerHeader.tsx`"). This adapter mirrors the OLD signature/shape
 * exactly (`(live, streamOffline, reduced, routeSymbol?) => {tone,text,tip,dot,pulse,warnIcon} |
 * null`) over the NEW resolver + pure chip-content function, so the call site below needs no
 * further shape change.
 */
function chip(
  live: LiveUpdate | null,
  streamOffline: boolean,
  reduced: boolean,
  routeSymbol?: string,
) {
  const route = routeSymbol ?? live?.ticker ?? '';
  const state = connectionStateFor({ live, streamOffline, routeSymbol: route });
  if (state == null) return null;
  return resolveChipContent(state, live, route, reduced);
}

// ---- Fixtures --------------------------------------------------------------------------------
function marketState(over: Partial<MarketState> = {}): MarketState {
  return {
    ticker: 'TSLA',
    price: 415.99,
    gex_spot: 410,
    timestamp: 1,
    timestamp_iso: '2026-06-23T14:30:00Z',
    call_wall: 430,
    put_wall: 400,
    peak_gex_strike: 420,
    gamma_flip: 408,
    max_pain: 415,
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
    vwap: 414,
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
    ...over,
  } as MarketState;
}
const signals: Signals = {
  ticker: 'TSLA',
  regime: 'positive_gamma',
  regime_note: null,
  vol_regime: 'neutral',
  distances: {},
  setups: [],
  opportunity_score: 73,
  opportunity_tier: 'actionable',
  prime_prompt_eligible: false,
} as Signals;

function liveUpdate(
  over: Partial<LiveUpdate> & { session_tape?: SessionTapeOccupancy } = {},
): LiveUpdate {
  return {
    ticker: 'TSLA',
    mid: 416.5,
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
    gamma_flip: 408,
    last_trade: 416.13,
    ...over,
  } as LiveUpdate;
}

function tapeOcc(over: Partial<SessionTapeOccupancy> = {}): SessionTapeOccupancy {
  return {
    symbol: 'SPY',
    et_date: '2026-08-10',
    tape_time_et: '09:35:00',
    phase: 'playing',
    pace: 1,
    ...over,
  };
}

// A harness that supplies the real `usePersona` (client-local, no network) to the deck.
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
    routeSymbol: 'TSLA',
    onSelectQuickSymbol: vi.fn(),
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
    constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
      ioCallback = cb;
    }
    observe() {
      return undefined;
    }
    disconnect() {
      return undefined;
    }
    unobserve() {
      return undefined;
    }
  }
  vi.stubGlobal('IntersectionObserver', MockIO as unknown as typeof IntersectionObserver);
}
function setDeckVisible(visible: boolean) {
  act(() => {
    ioCallback?.([{ isIntersecting: visible }]);
  });
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
describe('connectionChip — the single stream-driven chip (unit)', () => {
  it('not-this-ticker chip names the armed identity', () => {
    const c = chip(
      liveUpdate({
        ticker: 'QQQ',
        live: false,
        feed: 'session_tape',
        session_tape: tapeOcc(),
      }),
      false,
      false,
      'QQQ',
    );
    expect(c?.text).toBe('session tape · SPY · Mon Aug 10 · not this ticker');
  });
});

// ============================================================================================
describe('CommandDeck — sticky condensed bar (state-driven scroll condense + live isolation)', () => {
  it('FREEZES on an SSE drop — the STATIC price + offline chip, never the stale live mid as current', () => {
    installIntersectionObserver();
    renderDeck({
      live: liveUpdate({ live: true, mid: 416.5 }),
      isLive: false,
      streamOffline: true,
    });
    setDeckVisible(false);
    const sticky = screen.getByTestId('deck-sticky');
    expect(sticky).toHaveTextContent('TSLA · $415.99'); // static price, NOT the stale 416.50 live mid
    expect(within(sticky).getByText('Live offline — reconnecting…')).toBeInTheDocument();
    expect(within(sticky).queryByText(/● live/)).toBeNull();
  });
});

// ============================================================================================
describe('CommandDeck — Expirations tri-state wire semantics (null = all · subset · [] = none)', () => {
  it('all ticked → null; a partial pick → the explicit subset; none → []', async () => {
    const user = userEvent.setup();

    // Ticking the last unticked date reaches "all" → null (no filter), NOT the full list.
    const onAll = vi.fn();
    const r1 = renderDeck({
      selected: ['2026-06-26'],
      checked: ['2026-06-26'],
      onSelectExpirations: onAll,
    });
    await user.click(screen.getByLabelText('Expirations'));
    await user.click(screen.getByText('2026-07-03'));
    expect(onAll).toHaveBeenLastCalledWith(null);
    r1.unmount();

    // Unticking one from "all" → the explicit remaining subset.
    const onSubset = vi.fn();
    const r2 = renderDeck({
      selected: null,
      checked: ['2026-06-26', '2026-07-03'],
      onSelectExpirations: onSubset,
    });
    await user.click(screen.getByLabelText('Expirations'));
    await user.click(screen.getByText('2026-07-03'));
    expect(onSubset).toHaveBeenLastCalledWith(['2026-06-26']);
    r2.unmount();

    // Unticking the only remaining date → [] (none), NOT null.
    const onNone = vi.fn();
    renderDeck({
      selected: ['2026-06-26'],
      checked: ['2026-06-26'],
      onSelectExpirations: onNone,
    });
    await user.click(screen.getByLabelText('Expirations'));
    await user.click(screen.getByText('2026-06-26'));
    expect(onNone).toHaveBeenLastCalledWith([]);
  });
});

/**
 * AC-1c (SB) / AC-1b (SB) / AC-16 — the required dot CENSUS (GATE Q bounce, curvature-v2-foundations,
 * finding 2: "the required dot-census test does not exist"). QA found three figures wearing
 * `figure-live-dot` while the chip resolved to `closed` (a wire-real `market_session:'closed'` +
 * `live:true` combination — `apps/api/src/routes/stream.rs` derives the two independently) and while
 * a session tape was replaying (every standing) — because the chip and `LiveTape` answered "is this
 * live?" with two different predicates. `LiveTape.spec.tsx` and `DealerPositioning.spec.tsx` never
 * rendered the two widgets TOGETHER and never counted `figure-live-dot`, so the leak shipped green.
 *
 * This spec renders `LiveTape` + `DealerPositioning` together (the two `FigureCell` consumers, SPEC
 * §2.3) off the SAME `{live, streamOffline}` fact the real `liveTapeStore` would hold — publishing
 * into the store rather than hand-deriving `isLive`/`displayActive` overrides, so this is exactly
 * what `TickerDashboard` feeds both widgets in production — and counts dots across the six
 * connection `kind`s and every replay standing.
 *
 * Before the fix (`LiveTape.tsx` deriving its liveness from `numbersActive` instead of the shared
 * `isDeliveringLive` predicate) the "closed with a live:true glitch" and every "replay standing" case
 * below fails (3 dots, not 0). After the fix they pass. See BUILD_REPORT.md's GATE Q bounce entry for
 * the recorded before/after run.
 */
import { theme } from '@/shared/theme/theme';
import type { LiveUpdate, MarketState, OffExchange, Signals } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveConnectionState } from './connection/connectionState';
import { publishLiveTape, resetLiveTape } from './liveTapeStore';
import type { SessionTapeOccupancy } from './sessionTapeStanding';
import { DealerPositioning } from './widgets/dealer-positioning/DealerPositioning';
import { LiveTape } from './widgets/live-tape/LiveTape';

afterEach(() => {
  cleanup();
  resetLiveTape();
});

const TICKER = 'SPY';

const marketState = (over: Partial<MarketState> = {}): MarketState => ({
  ticker: TICKER,
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
  straddle_move: {
    state: 'not_computed',
    as_of: null,
    session_basis: null,
    anchor_spot: null,
    anchor_basis: 'gex_spot',
    anchor_label: 'gex_spot',
    primary_expiration: null,
    wide_quote_threshold_pct: 15,
    tenors: [],
  },
  ...over,
});

const liveUpdate = (over: Partial<LiveUpdate> = {}): LiveUpdate =>
  ({
    ticker: TICKER,
    mid: 573.12,
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
    feed: 'massive',
    ts: 0,
    gamma_flip: 251,
    last_trade: 573.1,
    ...over,
  }) as LiveUpdate;

const occ = (over: Partial<SessionTapeOccupancy> = {}): SessionTapeOccupancy => ({
  symbol: TICKER,
  et_date: '2026-09-02',
  tape_time_et: '09:35:00',
  phase: 'playing',
  pace: 1,
  ...over,
});

const signals: Signals = {
  ticker: TICKER,
  regime: 'positive_gamma',
  regime_note: null,
  vol_regime: 'neutral',
  distances: {},
  setups: [],
  opportunity_score: 73,
  opportunity_tier: 'actionable',
  prime_prompt_eligible: false,
};

const offEx: OffExchange = {
  ratio_pct: 38,
  offex_shares: 38_000,
  total_shares: 100_000,
  levels: [],
  blocks: [],
  block_min_shares: 5000,
  note: '',
};

function mountWidgets() {
  return render(
    <ThemeProvider theme={theme}>
      <LiveTape m={marketState()} />
      <DealerPositioning
        m={marketState()}
        sig={signals}
        offExchange={offEx}
        volOiThreshold={1}
        unusualCount={0}
        tierWord="Actionable"
        opportunityScore={73}
      />
    </ThemeProvider>,
  );
}

/** Publishes into the REAL `liveTapeStore` — never a hand-derived `isLive`/`displayActive` prop
 *  override — so `LiveTape` reads exactly what `TickerDashboard` feeds it in production. */
function renderPage(live: LiveUpdate | null, streamOffline: boolean) {
  publishLiveTape({ live, streamOffline, ticker: TICKER });
  return mountWidgets();
}

function totalDots(): number {
  return screen.queryAllByTestId('figure-live-dot').length;
}

function widgetCells(widgetId: string): HTMLElement[] {
  return Array.from(
    screen.getByTestId(`widget-${widgetId}`).querySelectorAll<HTMLElement>('[data-figure-state]'),
  );
}

describe('AC-1c (SB) — the dot census: LiveTape + DealerPositioning together, every connection kind', () => {
  it('LIVE — exactly three dots page-wide (Net flow, Spread, Gamma flip); VWAP and all 12 dealer-positioning cells are dotless', () => {
    const live = liveUpdate();
    expect(resolveConnectionState({ live, streamOffline: false, routeSymbol: TICKER }).kind).toBe(
      'live',
    );
    renderPage(live, false);

    const liveTapeCells = widgetCells('live-tape');
    const dealerCells = widgetCells('dealer-positioning');
    expect(liveTapeCells).toHaveLength(4);
    expect(dealerCells).toHaveLength(12);

    expect(totalDots()).toBe(3);
    expect(
      dealerCells.every((c) => c.querySelector('[data-testid="figure-live-dot"]') == null),
    ).toBe(true);

    const vwapCell = screen.getByText('VWAP').closest('[data-figure-state]') as HTMLElement;
    expect(within(vwapCell).queryByTestId('figure-live-dot')).toBeNull();
    expect(vwapCell.dataset.figureState).toBe('default');
  });

  it.each([
    ['closed', liveUpdate({ market_session: 'closed', live: false }), false],
    [
      'closed with a wire live:true glitch (finding 1 case A — stream.rs derives `live` from tick ' +
        'recency and `market_session` from the ET clock independently, so this combination is real)',
      liveUpdate({ market_session: 'closed', live: true }),
      false,
    ],
    ['overnight', liveUpdate({ market_session: 'overnight', live: false }), false],
    ['noTicks', liveUpdate({ market_session: 'regular', live: false }), false],
    ['offline (watchdog expired)', liveUpdate(), true],
  ] as const)('%s — zero dots anywhere on the page', (label, live, streamOffline) => {
    const kind = resolveConnectionState({ live, streamOffline, routeSymbol: TICKER }).kind;
    expect(kind, `fixture for "${label}" must actually resolve to a non-live kind`).not.toBe('live');
    renderPage(live, streamOffline);
    expect(totalDots()).toBe(0);
  });

  it.each([
    ['starting', occ({ tape_time_et: null })],
    ['playing', occ()],
    ['gap', occ({ phase: 'gap' })],
    ['ended', occ({ phase: 'ended' })],
    ['fault', occ({ phase: 'fault' })],
    ['not-this-ticker', occ({ symbol: 'QQQ' })],
  ] as const)(
    'replay standing "%s" — zero dots anywhere on the page (finding 1 case B: F6 must be reachable)',
    (_label, occupancy) => {
      const live = liveUpdate({ session_tape: occupancy } as Partial<LiveUpdate>);
      const state = resolveConnectionState({ live, streamOffline: false, routeSymbol: TICKER });
      expect(state.kind).toBe('replay');
      renderPage(live, false);
      expect(totalDots()).toBe(0);
      // F6 must be REACHABLE, not dotless merely because the value is also absent — Net flow
      // renders a REAL number from the replayed tape here (never `—`), yet still carries no dot.
      const netFlowCell = screen.getByText(/Net flow/).closest('[data-figure-state]') as HTMLElement;
      expect(netFlowCell.dataset.figureState).toBe('replay');
      expect(within(netFlowCell).queryByTestId('figure-live-dot')).toBeNull();
    },
  );

  it('replay standing "drop" (stream died mid-replay) — zero dots anywhere on the page', () => {
    // Mirrors useTickerStream.ts's watchdog: the FIRST publish carries the tape payload, the SECOND
    // (the drop) carries only `streamOffline` — `lastSessionPhase` survives from the first.
    publishLiveTape({
      live: liveUpdate({ session_tape: occ({ phase: 'playing' }) } as Partial<LiveUpdate>),
      streamOffline: false,
      ticker: TICKER,
    });
    publishLiveTape({ streamOffline: true });
    mountWidgets();
    expect(totalDots()).toBe(0);
  });
});

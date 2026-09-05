/**
 * AC-1c (SB) / AC-1b (SB) / AC-16 — the required dot CENSUS (GATE Q bounce, curvature-v2-foundations,
 * finding 2: "the required dot-census test does not exist"). QA found three figures wearing
 * `figure-live-dot` while the chip resolved to `closed` (a wire-real `market_session:'closed'` +
 * `live:true` combination — `apps/api/src/routes/stream.rs` derives the two independently) and while
 * a session tape was replaying (every standing) — because the chip and `LiveTape` answered "is this
 * live?" with two different predicates. `LiveTape.spec.tsx` and the OLD dealer positioning widget's
 * own spec (deleted whole at FE-8) never rendered the two widgets TOGETHER and never counted
 * `figure-live-dot`, so the leak shipped green.
 *
 * (curvature-v2-desk-and-read FE-8) the old dealer positioning widget is deleted; its twelve cells'
 * successors are `StructureHeroPanel` (which now hosts `LevelLadder` + `LadderFoot` — 3 ladder rows +
 * 2 foot cells) and `ReadStrip` (the other seven + opportunity). This spec renders `LiveTape` +
 * `StructureHeroPanel` + `ReadStrip` together off the SAME `{live, streamOffline}` fact the real
 * `liveTapeStore` would hold — publishing into the store rather than hand-deriving
 * `isLive`/`displayActive` overrides, so this is exactly what `TickerDashboard` feeds all three in
 * production — and counts dots across the six connection `kind`s and every replay standing.
 *
 * ONE GENUINELY NEW LIVE FIGURE, disclosed not hidden: the ladder's `Mid` row (SPEC §2.3 — "the mid
 * the only live row") did not exist as a cell on the old widget at all (the old grid never showed a
 * mid tile). Under a real `live` connection it now legitimately wears a dot too, so the page-wide LIVE
 * count below is FOUR (Net flow, Spread, Gamma flip, ladder Mid), not the old three — a real, correct
 * behavioural difference, not a widened assertion. The twelve cells INHERITED from the old widget
 * (ladder's Call wall/Put wall/Max pain, its foot's two GEX cells, the strip's seven) stay dotless in
 * every case below, checked individually by label so the ladder's own two new rows (Mid, Gamma flip)
 * never get silently folded into that count.
 *
 * Before the fix (`LiveTape.tsx` deriving its liveness from `numbersActive` instead of the shared
 * `isDeliveringLive` predicate) the "closed with a live:true glitch" and every "replay standing" case
 * below fails (3 dots, not 0). After the fix they pass. See BUILD_REPORT.md's GATE Q bounce entry for
 * the recorded before/after run.
 */
import { theme } from '@/shared/theme/theme';
import type { LiveUpdate, MarketState, OffExchange } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveConnectionState } from './connection/connectionState';
import { publishLiveTape, resetLiveTape } from './liveTapeStore';
import type { SessionTapeOccupancy } from './sessionTapeStanding';
import { LiveTape } from './widgets/live-tape/LiveTape';
import { buildReadStrip, ReadStrip } from './widgets/read-strip';
import { StructureHeroPanel } from './widgets/structure-hero';

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

const offEx: OffExchange = {
  ratio_pct: 38,
  offex_shares: 38_000,
  total_shares: 100_000,
  levels: [],
  blocks: [],
  block_min_shares: 5000,
  note: '',
};

/** The twelve cells the old dealer positioning widget used to render, by their SHIPPED label text —
 *  spread across
 *  the ladder (3), the ladder foot (2) and the read strip (7). Deliberately excludes the ladder's
 *  `Mid` and `Gamma flip` rows, which are NEW figures the old grid never had (module doc above). */
const INHERITED_TWELVE_LABELS = [
  'Call wall',
  'Put wall',
  'Max pain',
  'Vol-norm GEX',
  'Raw GEX (1% shock)',
  'Net DEX',
  'IV / HV',
  'Vol/OI',
  'IV skew',
  'Term structure',
  'Off-exchange %',
  'Opportunity',
] as const;

function mountWidgets() {
  const m = marketState();
  return render(
    <ThemeProvider theme={theme}>
      <LiveTape m={m} />
      <StructureHeroPanel symbol={TICKER} m={m} strikes={[]} />
      <ReadStrip
        cells={buildReadStrip({
          m,
          offExchange: offEx,
          volOiThreshold: 1,
          unusualCount: 0,
          tierWord: 'Actionable',
          opportunityScore: 73,
          ivRank: null,
        })}
      />
    </ThemeProvider>,
  );
}

/** Publishes into the REAL `liveTapeStore` — never a hand-derived `isLive`/`displayActive` prop
 *  override — so `LiveTape` (and `StructureHeroPanel`'s own single store read) reads exactly what
 *  `TickerDashboard` feeds it in production. */
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

/** Every one of the twelve cells inherited from the old dealer positioning widget, wherever it now
 *  lives, by label. */
function inheritedCells(): HTMLElement[] {
  return INHERITED_TWELVE_LABELS.map(
    (label) => screen.getByText(label).closest('[data-figure-state]') as HTMLElement,
  );
}

describe('AC-1c (SB) — the dot census: LiveTape + StructureHeroPanel + ReadStrip together, every connection kind', () => {
  it('LIVE — exactly FOUR dots page-wide (Net flow, Spread, Gamma flip, ladder Mid); VWAP and all 12 cells inherited from the old dealer positioning widget are dotless', () => {
    const live = liveUpdate();
    expect(resolveConnectionState({ live, streamOffline: false, routeSymbol: TICKER }).kind).toBe(
      'live',
    );
    renderPage(live, false);

    const liveTapeCells = widgetCells('live-tape');
    const inherited = inheritedCells();
    expect(liveTapeCells).toHaveLength(4);
    expect(inherited).toHaveLength(12);

    // The ladder's `Mid` row is the ONE genuinely new live figure (module doc above) — the census
    // must find it, or this test would silently stop proving the ladder participates at all.
    expect(totalDots()).toBe(4);
    expect(inherited.every((c) => c.querySelector('[data-testid="figure-live-dot"]') == null)).toBe(
      true,
    );

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
    expect(kind, `fixture for "${label}" must actually resolve to a non-live kind`).not.toBe(
      'live',
    );
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
      const netFlowCell = screen
        .getByText(/Net flow/)
        .closest('[data-figure-state]') as HTMLElement;
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

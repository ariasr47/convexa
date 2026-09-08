/**
 * `StructureHeroPanel` — RISK-BASED spec (curvature-v2-desk-and-read, SPEC §2.1/§2.5/§4.1/§4.2,
 * FE-6 criteria 9 (SB), 10 (SB), 19 (SB), plus the structural invariants the criteria list assumes
 * (single store read, palette identity, inner boundary). Criteria 20/23/24 are proven at their own
 * pure-function/component level (`paintStep.spec.ts`, `level-ladder/*.spec.tsx`,
 * `StructureFieldCanvas.spec.tsx`) — not re-proven here. Criteria 21/22/52 are `review` (browser).
 *
 * GATE Z (FE-11): the ladder mid row's and tape-trail row's own offline/stale + F6 replay treatment
 * (SPEC §4.1, criterion 16b) — the STANDING-UNION integration proof (offline dims + pause marks both
 * readouts; a replay standing renders F6 in both, full strength, no pause mark, no dot, with a REAL
 * replayed value — never vacuous — mirroring `live-dot-census.spec.tsx`'s own "F6 must be reachable"
 * discipline for the LiveTape cells).
 */
import type { StructureFieldCanvasProps } from '@/shared/charts/structure-field';
import { lightTheme, theme } from '@/shared/theme/theme';
import type { LiveUpdate, MarketState, StrikeRow } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publishLiveTape, resetLiveTape } from '../../liveTapeStore';
import type { SessionTapeOccupancy } from '../../sessionTapeStanding';
import type { LevelLadderProps } from '../level-ladder';
import { StructureHeroPanel } from './StructureHeroPanel';

const captured: { canvas: StructureFieldCanvasProps[]; ladder: LevelLadderProps[] } = {
  canvas: [],
  ladder: [],
};
let canvasShouldThrow = false;

vi.mock('@/shared/charts/structure-field', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/charts/structure-field')>();
  return {
    ...actual,
    StructureFieldCanvas: (props: StructureFieldCanvasProps) => {
      captured.canvas.push(props);
      if (canvasShouldThrow) throw new Error('canvas boom');
      return <div data-testid="structure-field-canvas-stub" />;
    },
  };
});

// Wraps the REAL `LevelLadder` (never replaces it) purely to observe the `palette` object identity
// the host hands it — criterion 7's actual claim, not merely "the same colours."
vi.mock('../level-ladder', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../level-ladder')>();
  return {
    ...actual,
    LevelLadder: (props: LevelLadderProps) => {
      captured.ladder.push(props);
      return <actual.LevelLadder {...props} />;
    },
  };
});

const marketState = (over: Partial<MarketState> = {}): MarketState =>
  ({
    ticker: 'SPY',
    price: 450.25,
    gex_spot: 450,
    timestamp: 1,
    timestamp_iso: '2026-06-23T14:30:00Z',
    call_wall: 460,
    put_wall: 440,
    peak_gex_strike: 455,
    gamma_flip: 449,
    max_pain: 450,
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
    vwap: 449,
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
  }) as MarketState;

const liveUpdate = (over: Partial<LiveUpdate> = {}): LiveUpdate =>
  ({
    ticker: 'SPY',
    mid: 450.9,
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
    gamma_flip: 448,
    last_trade: 450.85,
    ...over,
  }) as LiveUpdate;

const strike = (over: Partial<StrikeRow> = {}): StrikeRow => ({
  strike: 450,
  net_gex: 1e6,
  call_gex: 1e6,
  put_gex: 0,
  call_oi: 0,
  put_oi: 0,
  total_oi: 0,
  net_dex: null,
  vol_oi_ratio: null,
  volume: null,
  ...over,
});

const strikes: StrikeRow[] = [
  strike({ strike: 430 }),
  strike({ strike: 440 }),
  strike({ strike: 450 }),
  strike({ strike: 460 }),
  strike({ strike: 470 }),
];

function renderHero() {
  return render(
    <ThemeProvider theme={theme}>
      <StructureHeroPanel
        symbol="SPY"
        m={marketState()}
        strikes={strikes}
        structureAgeSeconds={42}
      />
    </ThemeProvider>,
  );
}

describe('StructureHeroPanel', () => {
  beforeEach(() => {
    resetLiveTape();
    captured.canvas.length = 0;
    captured.ladder.length = 0;
    canvasShouldThrow = false;
  });

  afterEach(() => {
    cleanup();
    act(() => resetLiveTape());
    vi.restoreAllMocks();
  });

  it('criterion 9 (SB): no free-standing liveness WORD anywhere in the hero, live or dropped', () => {
    publishLiveTape({ ticker: 'SPY', live: liveUpdate(), streamOffline: false });
    const { unmount } = renderHero();
    const root = screen.getByTestId('structure-hero');
    expect(root.textContent).not.toMatch(/\bLive\b/);
    expect(root.textContent).not.toMatch(/\bOffline\b/);
    unmount();

    publishLiveTape({ ticker: 'SPY', live: null, streamOffline: true });
    renderHero();
    const rootOffline = screen.getByTestId('structure-hero');
    expect(rootOffline.textContent).not.toMatch(/\bLive\b/);
    expect(rootOffline.textContent).not.toMatch(/\bOffline\b/);
  });

  it('criterion 10 (SB): the mid readout is labelled `Mid`, never the structure mid, and makes no live claim when delivering with no mid', () => {
    // Genuinely delivering, but the tick carries no mid.
    publishLiveTape({
      ticker: 'SPY',
      live: liveUpdate({ mid: null as unknown as number }),
      streamOffline: false,
    });
    renderHero();
    const readout = screen.getByTestId('tape-mid-readout');
    expect(readout).toHaveTextContent('Mid —');
    expect(readout.textContent).not.toContain('450');
  });

  it('criterion 10 (SB): a genuinely present live mid renders under `Mid`, never re-labelled `Live`', () => {
    publishLiveTape({ ticker: 'SPY', live: liveUpdate({ mid: 451.2 }), streamOffline: false });
    renderHero();
    const readout = screen.getByTestId('tape-mid-readout');
    expect(readout).toHaveTextContent('Mid $451.20');
  });

  const STRUCTURE_ROW_TICKS = [
    'ladder-tick-callWall',
    'ladder-tick-putWall',
    'ladder-tick-maxPain',
    'ladder-tick-gammaFlip',
  ];

  /** Each row's own text — the tick's PARENT (`Stack`) also contains that row's `FigureCell` as its
   *  only sibling, so this reads exactly one row's label+value+caption, never the whole ladder
   *  (which would also fold in the MID row's text — the one row criterion 19 deliberately excludes,
   *  since only the mid may change/dim on a drop). */
  function structureRowTexts(): Record<string, string | null> {
    const out: Record<string, string | null> = {};
    for (const id of STRUCTURE_ROW_TICKS) {
      out[id] = screen.getByTestId(id).parentElement?.textContent ?? null;
    }
    return out;
  }

  it("criterion 19 (SB): on a drop, the ladder's four structure rows render identical text and stay un-dimmed", () => {
    publishLiveTape({ ticker: 'SPY', live: liveUpdate(), streamOffline: false });
    const { unmount } = renderHero();
    const before = structureRowTexts();
    for (const text of Object.values(before)) expect(text).toBeTruthy();
    unmount();

    publishLiveTape({ ticker: 'SPY', live: null, streamOffline: true });
    renderHero();
    const after = structureRowTexts();
    expect(after).toEqual(before);

    for (const id of STRUCTURE_ROW_TICKS) {
      const tick = screen.getByTestId(id);
      const cell = tick.parentElement?.querySelector('[data-figure-state]') ?? null;
      expect(cell).not.toBeNull();
      expect(getComputedStyle(cell as Element).opacity).not.toBe('0.5');
    }
  });

  it('criterion 7: the canvas and the ladder receive the SAME `palette` object BY IDENTITY, not just equal values', () => {
    publishLiveTape({ ticker: 'SPY', live: liveUpdate(), streamOffline: false });
    renderHero();
    expect(captured.canvas.length).toBeGreaterThan(0);
    expect(captured.ladder.length).toBeGreaterThan(0);
    const canvasPalette = captured.canvas[captured.canvas.length - 1].palette;
    const ladderPalette = captured.ladder[captured.ladder.length - 1].palette;
    expect(ladderPalette).toBe(canvasPalette);
  });

  it("criterion 53 (ported from the deleted `GexProfileChart`/`chart.spec.tsx`, GATE Z FE-11): the resolved `surfaces` object never renders the same across the dark and light schemes — this is now the desk's ONLY structure-instrument host, so its own scheme resolution carries the proof `GexProfileChart` used to", () => {
    publishLiveTape({ ticker: 'SPY', live: liveUpdate(), streamOffline: false });
    const { unmount } = render(
      <ThemeProvider theme={theme}>
        <StructureHeroPanel
          symbol="SPY"
          m={marketState()}
          strikes={strikes}
          structureAgeSeconds={42}
        />
      </ThemeProvider>,
    );
    const dark = captured.canvas[captured.canvas.length - 1].surfaces;
    unmount();
    captured.canvas.length = 0;

    render(
      <ThemeProvider theme={lightTheme}>
        <StructureHeroPanel
          symbol="SPY"
          m={marketState()}
          strikes={strikes}
          structureAgeSeconds={42}
        />
      </ThemeProvider>,
    );
    const light = captured.canvas[captured.canvas.length - 1].surfaces;

    const keys = Object.keys(dark) as (keyof typeof dark)[];
    const differing = keys.filter((k) => dark[k] !== light[k]);
    expect(differing.length).toBeGreaterThan(0);
  });

  it('inner boundary (SPEC §5): a canvas fault degrades to a static message WITHOUT taking the ladder, the tape row or the path strip', () => {
    canvasShouldThrow = true;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    publishLiveTape({ ticker: 'SPY', live: liveUpdate(), streamOffline: false });
    renderHero();
    expect(screen.getByTestId('widget-error-boundary')).toBeInTheDocument();
    expect(screen.getByTestId('level-ladder')).toBeInTheDocument();
    expect(screen.getByTestId('tape-trail-row')).toBeInTheDocument();
    expect(screen.getByTestId('structure-history')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('the Field/Magnet toggle testids are preserved (rename target for FE-12 e2e, not a rewrite)', async () => {
    publishLiveTape({ ticker: 'SPY', live: liveUpdate(), streamOffline: false });
    renderHero();
    expect(screen.getByTestId('dealer-view-toggle')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('dealer-view-toggle')).getByTestId('dealer-view-levels'),
    ).toBeInTheDocument();
    const magnetBtn = within(screen.getByTestId('dealer-view-toggle')).getByTestId(
      'dealer-view-magnet',
    );
    await userEvent.click(magnetBtn);
    expect(screen.getByTestId('wall-magnet-view')).toBeInTheDocument();
    // The ladder/tape/path stay mounted regardless of which paint is selected for the canvas region.
    expect(screen.getByTestId('level-ladder')).toBeInTheDocument();
  });

  const occ = (over: Partial<SessionTapeOccupancy> = {}): SessionTapeOccupancy => ({
    symbol: 'SPY',
    et_date: '2026-09-02',
    tape_time_et: '09:35:00',
    phase: 'playing',
    pace: 1,
    ...over,
  });

  /** Scoped to the ladder only — the tape-trail readout ALSO renders a "Mid" text node, so an
   *  unscoped `screen.getByText('Mid')` is ambiguous once both surfaces are mounted together. */
  function ladderMidCard(): HTMLElement {
    const ladder = screen.getByTestId('level-ladder');
    return within(ladder)
      .getByTestId('ladder-tick-mid')
      .parentElement?.querySelector('[data-figure-state]') as HTMLElement;
  }

  describe('GATE Z (SPEC §4.1 "offline/stale" column) — the ladder mid row AND the tape-trail readout, together', () => {
    it('a genuine drop dims + pause-marks BOTH the ladder mid row and the tape-trail Mid readout; the four structure rows and Structure readout stay untouched', () => {
      publishLiveTape({ ticker: 'SPY', live: liveUpdate({ mid: 451.2 }), streamOffline: false });
      const { unmount } = renderHero();
      unmount();

      publishLiveTape({ ticker: 'SPY', live: null, streamOffline: true });
      renderHero();

      const midCard = ladderMidCard();
      expect(midCard).toHaveAttribute('data-figure-state', 'offline-bare');
      expect(midCard).toHaveTextContent('offline');

      expect(screen.getByTestId('tape-mid-pause')).toBeInTheDocument();
      expect(screen.getByTestId('tape-mid-readout')).toHaveTextContent('Mid —');
      expect(screen.getByTestId('tape-trail-caption')).toHaveTextContent('tape paused');

      // Structure readout (REST, never stream-derived) is untouched by the drop.
      const structureReadout = screen.getByTestId('tape-structure-readout');
      expect(getComputedStyle(structureReadout).opacity).not.toBe('0.5');
    });

    it('a drop with a retained latch: both readouts show the RETAINED number, dimmed, with a pause mark — never blanked', () => {
      // NEVER unmount between the live tick and the drop — the latch is component-local state
      // (`useStreamLatch`), so it only survives a REACTIVE re-render off the same store subscription,
      // not a fresh mount. `act()` flushes the store's `emit()` synchronously (mirrors
      // `LiveTape.spec.tsx`'s own `rerender()`-based latch proofs, adapted for a store-only reader).
      publishLiveTape({ ticker: 'SPY', live: liveUpdate({ mid: 451.2 }), streamOffline: false });
      renderHero();
      act(() => {
        publishLiveTape({ ticker: 'SPY', live: null, streamOffline: true });
      });

      // The mid latch retains the pre-drop value — both surfaces show it, not `—`. The ladder
      // formats via bare interpolation (`$451.2`, FE-5's own documented, unrelated cosmetic finding)
      // while the tape readout formats via `.toFixed(2)` (`$451.20`) — two different call sites'
      // existing formatting rules, not a new inconsistency this task introduces.
      const midCard = ladderMidCard();
      expect(midCard).toHaveAttribute('data-figure-state', 'offline-retained');
      expect(midCard).toHaveTextContent('offline · last known');
      expect(midCard).toHaveTextContent('$451.2');

      expect(screen.getByTestId('tape-mid-readout')).toHaveTextContent('Mid $451.20');
      expect(screen.getByTestId('tape-mid-pause')).toBeInTheDocument();
    });

    it('16b — a replay standing renders BOTH readouts as F6: full strength, no pause mark, a REAL replayed value (never vacuous)', () => {
      // The mid latch must never carry a pre-replay LIVE value into the replay arm (16a/16b's own
      // reset-token discipline) — start clean, straight into replay.
      const live = liveUpdate({
        mid: 573.12,
        session_tape: occ(),
      } as Partial<LiveUpdate>);
      publishLiveTape({ ticker: 'SPY', live, streamOffline: false });
      renderHero();

      const midCard = ladderMidCard();
      expect(midCard).toHaveAttribute('data-figure-state', 'replay');
      expect(midCard).toHaveTextContent('session replay');
      expect(midCard).toHaveTextContent('$573.12');
      // The pause-mark assertion IS the point of 16b — prove its absence, not merely the state name.
      expect(midCard.textContent).not.toMatch(/offline/);
      expect(within(midCard).queryByTestId('figure-live-dot')).toBeNull();

      expect(screen.getByTestId('tape-mid-readout')).toHaveTextContent('Mid $573.12');
      expect(screen.queryByTestId('tape-mid-pause')).toBeNull();
      expect(screen.queryByTestId('tape-trail-caption')).toBeNull();
    });

    it('16b — the four structure rows stay dotless, un-dimmed and offline-free during a replay standing too', () => {
      const live = liveUpdate({ mid: 573.12, session_tape: occ() } as Partial<LiveUpdate>);
      publishLiveTape({ ticker: 'SPY', live, streamOffline: false });
      renderHero();
      for (const id of [
        'ladder-tick-callWall',
        'ladder-tick-putWall',
        'ladder-tick-maxPain',
        'ladder-tick-gammaFlip',
      ]) {
        const cell = screen.getByTestId(id).parentElement?.querySelector('[data-figure-state]');
        expect(cell?.getAttribute('data-figure-state')).toBe('default');
      }
    });
  });

  // ===============================================================================================
  // Ticker fidelity repair, change 6 (F10 hero residual) — the header's `● mid · tape` chip
  // (`design/src/screens/desk.mjs:295`), which the app showed an ⓘ where the design shows this
  // instead (`STRUCTURE_HERO_REVIEW.md`'s own F10 finding). Genuinely live-gated (canon 22): mounted
  // only while the delivering-stream claim is true; absent (never a "not live" variant) otherwise —
  // before this repair `structure-hero-mid-tape-chip` did not exist at all.
  // ===============================================================================================
  describe('the header’s `● mid · tape` chip (F10 hero residual)', () => {
    it('mounts, with the live dot, while the stream is genuinely delivering', () => {
      publishLiveTape({ ticker: 'SPY', live: liveUpdate(), streamOffline: false });
      renderHero();
      const chip = screen.getByTestId('structure-hero-mid-tape-chip');
      expect(chip).toHaveTextContent('mid · tape');
      expect(within(chip).getByTestId('figure-live-dot')).toBeInTheDocument();
    });

    it('is ABSENT (never a muted/hollow variant) when the stream is offline', () => {
      publishLiveTape({ ticker: 'SPY', live: null, streamOffline: true });
      renderHero();
      expect(screen.queryByTestId('structure-hero-mid-tape-chip')).toBeNull();
    });

    it('is ABSENT before the first stream fact (no payload yet)', () => {
      renderHero();
      expect(screen.queryByTestId('structure-hero-mid-tape-chip')).toBeNull();
    });

    it('is ABSENT during a session-tape replay standing — `claim` is always false in replay (SPEC §2.1)', () => {
      const live = liveUpdate({ mid: 573.12, session_tape: occ() } as Partial<LiveUpdate>);
      publishLiveTape({ ticker: 'SPY', live, streamOffline: false });
      renderHero();
      expect(screen.queryByTestId('structure-hero-mid-tape-chip')).toBeNull();
    });
  });
});

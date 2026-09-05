/**
 * `StructureHeroPanel` — RISK-BASED spec (curvature-v2-desk-and-read, SPEC §2.1/§2.5/§4.1/§4.2,
 * FE-6 criteria 9 (SB), 10 (SB), 19 (SB), plus the structural invariants the criteria list assumes
 * (single store read, palette identity, inner boundary). Criteria 20/23/24 are proven at their own
 * pure-function/component level (`paintStep.spec.ts`, `level-ladder/*.spec.tsx`,
 * `StructureFieldCanvas.spec.tsx`) — not re-proven here. Criteria 21/22/52 are `review` (browser).
 */
import type { StructureFieldCanvasProps } from '@/shared/charts/structure-field';
import { theme } from '@/shared/theme/theme';
import type { LiveUpdate, MarketState, StrikeRow } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publishLiveTape, resetLiveTape } from '../../liveTapeStore';
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
});

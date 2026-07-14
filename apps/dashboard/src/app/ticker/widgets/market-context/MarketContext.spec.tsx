/**
 * MarketContext — Suite A (component states + copy, ai-context-pack FRONTEND_EXECUTION_CONTRACT §5).
 * Renders every required state off the additive `market_state.market_context` shape and asserts the
 * locked copy + the binding invariants:
 *   - `[best-effort-isolated-or-null]`: FIVE independent null levels (per-label / per-horizon /
 *     per-sub-component / per-read / whole-pack), each its own muted "unavailable this cycle" copy —
 *     NEVER a fabricated 0 / $0 / 0% / label / date.
 *   - `[live-vs-static-isolation]`: no `⏸ offline` caption in any state; no live/offline prop exists
 *     (compile-time-checked here, proven end-to-end in the flow spec).
 *   - Labels NEVER re-derived: the wire enum is authoritative (closed 1:1 lookup); an unknown enum
 *     renders that label's unavailable state (no raw pass-through, no FE threshold math).
 *   - `digested-labels-not-raw-dump` + `model-read-carries-its-assumptions` + honesty posture +
 *     `theme-token-discipline` (dark/light parity, zero hardcoded hex).
 */
import { ThemeProvider } from '@mui/material/styles';
import type {
  AtrRead,
  FlowVsPositioningRead,
  GexProfileShapeRead,
  MarketContextPack,
  TrendMomentumRead,
} from '@org/api';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { lightTheme, theme } from '../../../theme';
import { MarketContext } from './MarketContext';
import mcSource from './MarketContext.tsx?raw';
import {
  MC_ADVISORY,
  MC_ATR_EMPTY,
  MC_CELL_EMPTY,
  MC_COMPOSITION_ROW_EMPTY,
  MC_FLOW_BASIS,
  MC_FLOW_EMPTY,
  MC_LOCATION_ROW_EMPTY,
  MC_MOMENTUM_ROW_EMPTY,
  MC_SHAPE_EMPTY,
  MC_STRENGTH_ROW_EMPTY,
  MC_TI_EMPTY,
  MC_TREND_ROW_EMPTY,
  MC_WHOLE_EMPTY,
} from '../_kit/copy';

// ---- Fixtures (blueprint §3 numbers, so the expected display strings match the pinned anatomy).
// The wire `window`/`thresholds`/`flow_basis`/`method` descriptor strings carry sentinel values so
// any accidental FE render of them is caught (the FE has its OWN pinned copy — binding negative).
const WIRE_DESC = 'WIRE-DESCRIPTOR-NEVER-RENDERED';

const tiRead = (over: Partial<TrendMomentumRead> = {}): TrendMomentumRead => ({
  as_of_session: '2026-07-03',
  direction: {
    label: 'uptrend',
    close: 178.4,
    ema20: 176.21,
    ema50: 171.83,
    window: WIRE_DESC,
    thresholds: WIRE_DESC,
  },
  strength: { label: 'strong', adx: 28.4, window: WIRE_DESC, thresholds: WIRE_DESC },
  momentum: { label: 'neutral', rsi: 51.2, window: WIRE_DESC, thresholds: WIRE_DESC },
  ...over,
});
const shapeRead = (over: Partial<GexProfileShapeRead> = {}): GexProfileShapeRead => ({
  concentration: 0.41,
  concentration_label: 'concentrated',
  balance: 0.34,
  balance_label: 'above_skewed',
  center_of_mass_distance: 0.012,
  eligible_strikes: 23,
  spot_basis: 178.4,
  thresholds: WIRE_DESC,
  ...over,
});
const flowRead = (over: Partial<FlowVsPositioningRead> = {}): FlowVsPositioningRead => ({
  flow_basis: WIRE_DESC,
  location: { label: 'rotating', distribution_shift: 0.42, thresholds: WIRE_DESC },
  composition: {
    label: 'consistent',
    volume_pcr: 0.92,
    oi_pcr: 0.88,
    tilt_ratio: 1.05,
    thresholds: WIRE_DESC,
  },
  ...over,
});
const atrRead = (over: Partial<AtrRead> = {}): AtrRead => ({
  as_of_session: '2026-07-03',
  close_basis: 178.4,
  method: WIRE_DESC,
  atr_5d: { value: 4.12, pct_of_close: 2.31, window_bars: 5 },
  atr_14d: { value: 3.87, pct_of_close: 2.17, window_bars: 14 },
  atr_30d: { value: 3.51, pct_of_close: 1.97, window_bars: 30 },
  ...over,
});
const pack = (over: Partial<MarketContextPack> = {}): MarketContextPack => ({
  trend_momentum: tiRead(),
  gex_profile_shape: shapeRead(),
  flow_vs_positioning: flowRead(),
  atr: atrRead(),
  ...over,
});

function renderMc(value: MarketContextPack | null, t = theme) {
  return render(
    <ThemeProvider theme={t}>
      <MarketContext pack={value} />
    </ThemeProvider>,
  );
}

// Forbidden-language scan (AC-7): the pinned flow-basis line is the ONLY allowlisted carrier of the
// "buy/sell" negation phrase — strip it, then nothing rendered may match the banned set.
const BANNED = /\b(buy|sell|smart money|stop|target|sizing|distance to)\b/i;
const scanText = (el: HTMLElement) => (el.textContent ?? '').replaceAll(MC_FLOW_BASIS, '');

describe('MarketContext (component states — Suite A)', () => {
  // ---- T-AC-1 -------------------------------------------------------------------------------
  it('T-AC-1: Default — all four sub-cards render populated (labels + scalars + basis lines), no auth wiring', () => {
    renderMc(pack());
    // The static-family Widget shell + body.
    expect(screen.getByTestId('widget-market-context')).toBeInTheDocument();
    expect(screen.getByTestId('market-context')).toBeInTheDocument();

    // TI: 3 labels + their scalars.
    const ti = screen.getByTestId('mc-ti');
    expect(within(ti).getByText('Uptrend')).toBeInTheDocument();
    expect(within(ti).getByText('close 178.40 · EMA20 176.21 · EMA50 171.83')).toBeInTheDocument();
    expect(within(ti).getByText('Strong')).toBeInTheDocument();
    expect(within(ti).getByText('ADX(14) 28.4')).toBeInTheDocument();
    expect(within(ti).getByText('Neutral')).toBeInTheDocument();
    expect(within(ti).getByText('RSI(14) 51.2')).toBeInTheDocument();

    // Shape: 2 labels + 3 scalars + eligible_strikes (in the basis line).
    const shape = screen.getByTestId('mc-shape');
    expect(within(shape).getByText('Concentrated')).toBeInTheDocument();
    expect(within(shape).getByText('HHI 0.41')).toBeInTheDocument();
    expect(within(shape).getByText('Skewed above spot')).toBeInTheDocument();
    expect(within(shape).getByText('+0.34')).toBeInTheDocument();
    expect(within(shape).getByText('+1.2% vs spot')).toBeInTheDocument();
    expect(
      within(shape).getByText('At spot $178.40 · 23 strikes in the selected window'),
    ).toBeInTheDocument();

    // Flow: 2 labels + both PCRs + shift.
    const flow = screen.getByTestId('mc-flow');
    expect(within(flow).getByText('Rotating')).toBeInTheDocument();
    expect(within(flow).getByText('shift 0.42')).toBeInTheDocument();
    expect(within(flow).getByText('Consistent')).toBeInTheDocument();
    expect(within(flow).getByText('vol PCR 0.92 · OI PCR 0.88 · tilt 1.05')).toBeInTheDocument();

    // ATR: 3 horizons each $ + % (+ window in the basis line).
    const atr = screen.getByTestId('mc-atr');
    expect(within(atr).getByText('$4.12 · 2.3%')).toBeInTheDocument();
    expect(within(atr).getByText('$3.87 · 2.2%')).toBeInTheDocument();
    expect(within(atr).getByText('$3.51 · 2.0%')).toBeInTheDocument();

    // Chrome: subtitle (static frame) + no auth wiring (this widget takes only `pack` props).
    // NB: the negative auth-CTA scan must NOT match the feature's own domain copy — the flow basis
    // line legitimately says "today's session cumulative option volume" — so it targets auth CTA
    // phrases only, and uses queryAllByText (never throws on a legitimate multiple).
    expect(
      screen.getByText(
        'Context the AI also reads · snapshot, never live — refreshes with the data load, not the stream.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryAllByText(/sign in|sign up|log in|log out/i)).toHaveLength(0);
  });

  // ---- T-AC-2 (mapping fidelity — all 20 enum values) -----------------------------------------
  const MAPPING_CASES: Array<{
    name: string;
    row: string;
    expected: string;
    others: string[];
    value: MarketContextPack;
  }> = [
    // direction (3)
    ...(
      [
        ['uptrend', 'Uptrend'],
        ['downtrend', 'Downtrend'],
        ['mixed', 'Mixed'],
      ] as const
    ).map(([v, d]) => ({
      name: `direction=${v}`,
      row: 'mc-trend',
      expected: d,
      others: ['Uptrend', 'Downtrend', 'Mixed'].filter((s) => s !== d),
      value: pack({ trend_momentum: tiRead({ direction: { ...tiRead().direction!, label: v } }) }),
    })),
    // strength (3)
    ...(
      [
        ['weak', 'Weak'],
        ['moderate', 'Moderate'],
        ['strong', 'Strong'],
      ] as const
    ).map(([v, d]) => ({
      name: `strength=${v}`,
      row: 'mc-strength',
      expected: d,
      others: ['Weak', 'Moderate', 'Strong'].filter((s) => s !== d),
      value: pack({ trend_momentum: tiRead({ strength: { ...tiRead().strength!, label: v } }) }),
    })),
    // momentum (5)
    ...(
      [
        ['overbought', 'Overbought'],
        ['bullish', 'Bullish'],
        ['neutral', 'Neutral'],
        ['bearish', 'Bearish'],
        ['oversold', 'Oversold'],
      ] as const
    ).map(([v, d]) => ({
      name: `momentum=${v}`,
      row: 'mc-momentum',
      expected: d,
      others: ['Overbought', 'Bullish', 'Neutral', 'Bearish', 'Oversold'].filter((s) => s !== d),
      value: pack({ trend_momentum: tiRead({ momentum: { ...tiRead().momentum!, label: v } }) }),
    })),
    // concentration (3)
    ...(
      [
        ['concentrated', 'Concentrated'],
        ['mixed', 'Mixed'],
        ['dispersed', 'Dispersed'],
      ] as const
    ).map(([v, d]) => ({
      name: `concentration=${v}`,
      row: 'mc-concentration',
      expected: d,
      others: ['Concentrated', 'Mixed', 'Dispersed'].filter((s) => s !== d),
      value: pack({ gex_profile_shape: shapeRead({ concentration_label: v }) }),
    })),
    // balance (3)
    ...(
      [
        ['above_skewed', 'Skewed above spot'],
        ['balanced', 'Balanced'],
        ['below_skewed', 'Skewed below spot'],
      ] as const
    ).map(([v, d]) => ({
      name: `balance=${v}`,
      row: 'mc-balance',
      expected: d,
      others: ['Skewed above spot', 'Balanced', 'Skewed below spot'].filter((s) => s !== d),
      value: pack({ gex_profile_shape: shapeRead({ balance_label: v }) }),
    })),
    // location (3)
    ...(
      [
        ['aligned', 'Aligned'],
        ['rotating', 'Rotating'],
        ['divergent', 'Divergent'],
      ] as const
    ).map(([v, d]) => ({
      name: `location=${v}`,
      row: 'mc-location',
      expected: d,
      others: ['Aligned', 'Rotating', 'Divergent'].filter((s) => s !== d),
      value: pack({
        flow_vs_positioning: flowRead({ location: { ...flowRead().location!, label: v } }),
      }),
    })),
    // composition (3)
    ...(
      [
        ['flow_put_tilted', 'Flow put-tilted'],
        ['consistent', 'Consistent'],
        ['flow_call_tilted', 'Flow call-tilted'],
      ] as const
    ).map(([v, d]) => ({
      name: `composition=${v}`,
      row: 'mc-composition',
      expected: d,
      others: ['Flow put-tilted', 'Consistent', 'Flow call-tilted'].filter((s) => s !== d),
      value: pack({
        flow_vs_positioning: flowRead({ composition: { ...flowRead().composition!, label: v } }),
      }),
    })),
  ];

  it('T-AC-2: mapping fidelity — every one of the 20 pinned enum values renders EXACTLY its mapped display string', () => {
    expect(MAPPING_CASES).toHaveLength(23); // 3+3+5+3+3+3+3 — the full §3 enum set (7 label families)
    for (const c of MAPPING_CASES) {
      const { unmount } = renderMc(c.value);
      const row = screen.getByTestId(c.row);
      // The mapped display string renders in ITS row…
      expect(within(row).getByText(c.expected), c.name).toBeInTheDocument();
      // …and no OTHER display string of the same enum family renders in that row.
      for (const other of c.others) {
        expect(within(row).queryByText(other), `${c.name} must not show ${other}`).toBeNull();
      }
      // Never the raw wire enum (snake_case forms would leak; same-word enums like `neutral`
      // differ by case from the display string, which getByText treats exactly).
      expect(within(row).queryByText(/_/)).toBeNull();
      unmount();
    }
  });

  it('T-AC-2b / E-4: an UNKNOWN enum value renders that label’s unavailable state — never raw pass-through or invented text', () => {
    // direction: "sideways" (the contract's example)
    const p1 = pack({
      trend_momentum: tiRead({ direction: { ...tiRead().direction!, label: 'sideways' as never } }),
    });
    const r1 = renderMc(p1);
    expect(
      within(screen.getByTestId('mc-trend')).getByText(MC_TREND_ROW_EMPTY),
    ).toBeInTheDocument();
    expect(screen.queryByText(/sideways/i)).toBeNull();
    // Siblings still render (only that label degrades).
    expect(within(screen.getByTestId('mc-strength')).getByText('Strong')).toBeInTheDocument();
    r1.unmount();

    // concentration: unknown → row label kept, muted value cell (no pinned per-row sentence exists).
    const p2 = pack({
      gex_profile_shape: shapeRead({ concentration_label: 'clustered' as never }),
    });
    const r2 = renderMc(p2);
    const conc = screen.getByTestId('mc-concentration');
    expect(within(conc).getByText(MC_CELL_EMPTY)).toBeInTheDocument();
    expect(screen.queryByText(/clustered/i)).toBeNull();
    expect(
      within(screen.getByTestId('mc-balance')).getByText('Skewed above spot'),
    ).toBeInTheDocument();
    r2.unmount();

    // location: unknown → the pinned Location unavailable string.
    const p3 = pack({
      flow_vs_positioning: flowRead({
        location: { ...flowRead().location!, label: 'wandering' as never },
      }),
    });
    renderMc(p3);
    expect(
      within(screen.getByTestId('mc-location')).getByText(MC_LOCATION_ROW_EMPTY),
    ).toBeInTheDocument();
    expect(screen.queryByText(/wandering/i)).toBeNull();
  });

  // ---- T-AC-3 -------------------------------------------------------------------------------
  it('T-AC-3: digested-only — no table of periods, no chart/series/OHLC elements; the expanded overlay shows the same body', async () => {
    const user = userEvent.setup();
    const { container, baseElement } = renderMc(pack());
    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelector('.recharts-wrapper')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText(/OHLC/i)).toBeNull();

    // Expand (the functional Widget-shell affordance): the SAME body, larger — still no table/chart.
    await user.click(screen.getByRole('button', { name: 'Expand widget' }));
    const overlay = await screen.findByTestId('widget-overlay-market-context');
    expect(overlay).toBeInTheDocument();
    // The overlay body carries the same sub-cards (both instances of each testid exist now).
    expect(screen.getAllByTestId('mc-ti').length).toBeGreaterThanOrEqual(2);
    expect(baseElement.querySelector('table')).toBeNull();
    expect(baseElement.querySelector('.recharts-wrapper')).toBeNull();
  });

  // ---- T-AC-4 -------------------------------------------------------------------------------
  it('T-AC-4: all four basis lines are visible WITHOUT interaction; the flow line carries the pinned unsigned phrase verbatim', () => {
    renderMc(pack());
    expect(screen.getByTestId('mc-ti-basis')).toHaveTextContent(
      'As of session Fri Jul 3 · daily bars · EMA 20/50 · ADX(14) · RSI(14)',
    );
    expect(screen.getByTestId('mc-shape-basis')).toHaveTextContent(
      'At spot $178.40 · 23 strikes in the selected window',
    );
    expect(screen.getByTestId('mc-flow-basis')).toHaveTextContent(
      "Today's session cumulative option volume, unsigned (no buy/sell side)",
    );
    expect(screen.getByTestId('mc-flow-basis')).toHaveTextContent(MC_FLOW_BASIS);
    expect(screen.getByTestId('mc-atr-basis')).toHaveTextContent(
      'As of session Fri Jul 3 · vs close $178.40 · 5/14/30 trading bars',
    );
    // The wire descriptor strings are NEVER rendered (the FE has its own pinned copy).
    expect(screen.queryByText(new RegExp(WIRE_DESC))).toBeNull();
  });

  // ---- T-AC-5 -------------------------------------------------------------------------------
  it('T-AC-5: each of the 8 row labels exposes a tooltip with its window AND the exact pinned v1 thresholds', async () => {
    const user = userEvent.setup();
    renderMc(pack());
    const rows: Array<{ icon: string; markers: (string | RegExp)[] }> = [
      {
        icon: 'mc-info-trend',
        markers: ['daily closes', 'close above EMA20 above EMA50', 'about 100 daily bars'],
      },
      {
        icon: 'mc-info-strength',
        markers: [
          'ADX(14) on daily bars',
          '20–25 = Moderate',
          '25 and above = Strong',
          'about 43 bars',
        ],
      },
      {
        icon: 'mc-info-momentum',
        markers: ['RSI(14) on daily closes', '55–70 Bullish', '45–55 Neutral', 'about 42 bars'],
      },
      {
        icon: 'mc-info-concentration',
        markers: [
          'selected expiration window',
          '0.35 and above Concentrated',
          '0.15–0.35 Mixed',
          'below 0.15 Dispersed',
        ],
      },
      { icon: 'mc-info-balance', markers: ['spot basis', '+0.20 and above', '−0.20 and below'] },
      {
        icon: 'mc-info-center-of-mass',
        markers: ['signed distance from the spot basis', 'no label, no threshold'],
      },
      {
        icon: 'mc-info-location',
        markers: ['below 0.35', '0.35–0.60 Rotating', '0.60 and above Divergent', 'unsigned'],
      },
      {
        icon: 'mc-info-composition',
        markers: ['1.25 and above', '0.80 and below', 'volume PCR ÷ OI PCR'],
      },
    ];
    for (const r of rows) {
      const icon = screen.getByTestId(r.icon);
      await user.hover(icon);
      const tip = await screen.findByRole('tooltip');
      for (const m of r.markers) expect(tip, r.icon).toHaveTextContent(m as string);
      await user.unhover(icon);
      await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
    }
  }, 30_000);

  it('T-AC-5b: the four card-level ⓘ tooltips exist (incl. the ATR method + never-a-stop framing)', async () => {
    const user = userEvent.setup();
    renderMc(pack());
    const atrIcon = screen.getByTestId('mc-info-average-true-range');
    await user.hover(atrIcon);
    const tip = await screen.findByRole('tooltip');
    expect(tip).toHaveTextContent('simple mean of true range');
    expect(tip).toHaveTextContent('never a stop, a target, or a distance calculator');
    await user.unhover(atrIcon);
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
    // The other three card ⓘ affordances are present + wired.
    expect(screen.getByTestId('mc-info-trend-momentum')).toBeInTheDocument();
    expect(screen.getByTestId('mc-info-gamma-profile-shape')).toBeInTheDocument();
    expect(screen.getByTestId('mc-info-flow-vs-positioning-today')).toBeInTheDocument();
  });

  // ---- T-AC-6 -------------------------------------------------------------------------------
  it('T-AC-6: the advisory footer renders verbatim in Default AND in every L1–L4 state', () => {
    const states: MarketContextPack[] = [
      pack(), // Default
      pack({ trend_momentum: tiRead({ direction: null }) }), // L1
      pack({ atr: atrRead({ atr_14d: null }) }), // L2
      pack({ flow_vs_positioning: flowRead({ location: null }) }), // L3
      pack({ trend_momentum: null }), // L4
    ];
    for (const s of states) {
      const { unmount } = renderMc(s);
      expect(screen.getByTestId('mc-footer')).toHaveTextContent(MC_ADVISORY);
      unmount();
    }
  });

  // ---- T-AC-7 -------------------------------------------------------------------------------
  it('T-AC-7: forbidden-language scan — no buy/sell/smart-money/stop/target/sizing/distance-to wording in ANY state', () => {
    const states: (MarketContextPack | null)[] = [
      pack(),
      pack({ trend_momentum: tiRead({ direction: null, strength: null, momentum: null }) }),
      pack({ atr: atrRead({ atr_5d: null, atr_14d: null, atr_30d: null }) }),
      pack({ flow_vs_positioning: flowRead({ location: null }) }),
      pack({ flow_vs_positioning: flowRead({ composition: null }) }),
      pack({ trend_momentum: null }),
      pack({ gex_profile_shape: null }),
      pack({ flow_vs_positioning: null }),
      pack({ atr: null }),
      null, // L5
    ];
    for (const s of states) {
      const { container, unmount } = renderMc(s);
      expect(scanText(container)).not.toMatch(BANNED);
      unmount();
    }
  });

  // ---- T-AC-12 (×4) --------------------------------------------------------------------------
  it('T-AC-12: exactly one read null (×4 in turn) — only that sub-card shows its unavailable line; the other three render; no error banner', () => {
    const cases: Array<{
      over: Partial<MarketContextPack>;
      card: string;
      empty: string;
      othersRender: string[];
    }> = [
      {
        over: { trend_momentum: null },
        card: 'mc-ti',
        empty: MC_TI_EMPTY,
        othersRender: ['Concentrated', 'Rotating', '$4.12 · 2.3%'],
      },
      {
        over: { gex_profile_shape: null },
        card: 'mc-shape',
        empty: MC_SHAPE_EMPTY,
        othersRender: ['Uptrend', 'Rotating', '$4.12 · 2.3%'],
      },
      {
        over: { flow_vs_positioning: null },
        card: 'mc-flow',
        empty: MC_FLOW_EMPTY,
        othersRender: ['Uptrend', 'Concentrated', '$4.12 · 2.3%'],
      },
      {
        over: { atr: null },
        card: 'mc-atr',
        empty: MC_ATR_EMPTY,
        othersRender: ['Uptrend', 'Concentrated', 'Rotating'],
      },
    ];
    for (const c of cases) {
      const { unmount } = renderMc(pack(c.over));
      const card = screen.getByTestId(c.card);
      expect(within(card).getByText(c.empty)).toBeInTheDocument();
      // The null card carries ONLY its header + the muted line (no scalars, no basis, no 0s).
      expect(within(card).queryByText(/\$|%|\d\.\d/)).toBeNull();
      for (const t of c.othersRender) expect(screen.getByText(t)).toBeInTheDocument();
      // No error banner / retry surface; the advisory footer stays.
      expect(screen.queryByText(/retry|error/i)).toBeNull();
      expect(screen.getByTestId('mc-footer')).toHaveTextContent(MC_ADVISORY);
      unmount();
    }
  });

  // ---- T-AC-13 (×3) --------------------------------------------------------------------------
  it('T-AC-13: one TI label null (×3 in turn) — that row alone shows its unavailable string; siblings + basis line intact', () => {
    const cases: Array<{
      over: Partial<TrendMomentumRead>;
      row: string;
      empty: string;
      siblings: string[];
    }> = [
      {
        over: { direction: null },
        row: 'mc-trend',
        empty: MC_TREND_ROW_EMPTY,
        siblings: ['Strong', 'Neutral'],
      },
      {
        over: { strength: null },
        row: 'mc-strength',
        empty: MC_STRENGTH_ROW_EMPTY,
        siblings: ['Uptrend', 'Neutral'],
      },
      {
        over: { momentum: null },
        row: 'mc-momentum',
        empty: MC_MOMENTUM_ROW_EMPTY,
        siblings: ['Uptrend', 'Strong'],
      },
    ];
    for (const c of cases) {
      const { unmount } = renderMc(pack({ trend_momentum: tiRead(c.over) }));
      const row = screen.getByTestId(c.row);
      expect(within(row).getByText(c.empty)).toBeInTheDocument();
      // No fabricated scalar in the null row (its scalar line is absent).
      expect(within(row).queryByText(/\d/)).toBeNull();
      for (const s of c.siblings) expect(screen.getByText(s)).toBeInTheDocument();
      expect(screen.getByTestId('mc-ti-basis')).toBeInTheDocument();
      unmount();
    }
  });

  // ---- T-AC-15 -------------------------------------------------------------------------------
  it('T-AC-15: a null ATR horizon keeps its label with muted "unavailable this cycle"; siblings render; NEVER $0/0%', () => {
    renderMc(pack({ atr: atrRead({ atr_14d: null }) }));
    const row = screen.getByTestId('mc-atr-14d');
    // Label kept + the muted cell — and NOTHING else (no fabricated $0/0% — no digits beyond "14-day").
    expect(row.textContent).toBe(`14-day${MC_CELL_EMPTY}`);
    expect(within(screen.getByTestId('mc-atr-5d')).getByText('$4.12 · 2.3%')).toBeInTheDocument();
    expect(within(screen.getByTestId('mc-atr-30d')).getByText('$3.51 · 2.0%')).toBeInTheDocument();
    expect(screen.queryByText(/\$0\b/)).toBeNull();
  });

  it('T-AC-15b: two null ATR horizons — each its own muted cell; the remaining horizon renders', () => {
    renderMc(pack({ atr: atrRead({ atr_5d: null, atr_30d: null }) }));
    expect(screen.getByTestId('mc-atr-5d').textContent).toBe(`5-day${MC_CELL_EMPTY}`);
    expect(screen.getByTestId('mc-atr-30d').textContent).toBe(`30-day${MC_CELL_EMPTY}`);
    expect(within(screen.getByTestId('mc-atr-14d')).getByText('$3.87 · 2.2%')).toBeInTheDocument();
    // The basis line still renders (the read itself is non-null).
    expect(screen.getByTestId('mc-atr-basis')).toBeInTheDocument();
  });

  // ---- T-AC-16 (×2) --------------------------------------------------------------------------
  it('T-AC-16: location-only null — Location shows its unavailable string; Composition renders; flow-basis line stays', () => {
    renderMc(pack({ flow_vs_positioning: flowRead({ location: null }) }));
    expect(
      within(screen.getByTestId('mc-location')).getByText(MC_LOCATION_ROW_EMPTY),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('mc-composition')).getByText('Consistent'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('mc-composition')).getByText(
        'vol PCR 0.92 · OI PCR 0.88 · tilt 1.05',
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId('mc-flow-basis')).toBeInTheDocument();
  });

  it('T-AC-16b: composition-only null — Composition shows its unavailable string; Location renders; flow-basis line stays', () => {
    renderMc(pack({ flow_vs_positioning: flowRead({ composition: null }) }));
    expect(
      within(screen.getByTestId('mc-composition')).getByText(MC_COMPOSITION_ROW_EMPTY),
    ).toBeInTheDocument();
    expect(within(screen.getByTestId('mc-location')).getByText('Rotating')).toBeInTheDocument();
    expect(within(screen.getByTestId('mc-location')).getByText('shift 0.42')).toBeInTheDocument();
    expect(screen.getByTestId('mc-flow-basis')).toBeInTheDocument();
  });

  // ---- T-AC-17 (L5) --------------------------------------------------------------------------
  it('T-AC-17: whole-pack null — shell + single "Market context unavailable this cycle."; no sub-cards, no footer, no thrown error', () => {
    expect(() => renderMc(null)).not.toThrow();
    expect(screen.getByText(MC_WHOLE_EMPTY)).toBeInTheDocument();
    expect(screen.getByTestId('widget-market-context')).toBeInTheDocument();
    for (const id of ['mc-ti', 'mc-shape', 'mc-flow', 'mc-atr', 'mc-footer']) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
    expect(screen.queryByText(/\$0\b/)).toBeNull();
  });

  // ---- T-AC-18 (missing key ≡ L5) ------------------------------------------------------------
  it('T-AC-18: a pre-feature payload (no market_context key) renders the identical L5 state; console error/warn spies clean', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // The pre-feature shape: the key is ABSENT (optional on MarketState) — consumers read `?? null`.
    const preFeature: { market_context?: MarketContextPack | null } = {};
    renderMc(preFeature.market_context ?? null);
    expect(screen.getByText(MC_WHOLE_EMPTY)).toBeInTheDocument();
    expect(screen.queryByTestId('mc-ti')).toBeNull();
    expect(errSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
    warnSpy.mockRestore();
  });

  // ---- T-AC-24 (dark/light parity, token discipline) ------------------------------------------
  it('T-AC-24: Default + L5 render under BOTH dark and light themes; the component source carries zero hardcoded hex', () => {
    for (const t of [theme, lightTheme]) {
      const d = renderMc(pack(), t);
      expect(screen.getByText('Uptrend')).toBeInTheDocument();
      expect(screen.getByTestId('mc-footer')).toHaveTextContent(MC_ADVISORY);
      d.unmount();
      const e = renderMc(null, t);
      expect(screen.getByText(MC_WHOLE_EMPTY)).toBeInTheDocument();
      e.unmount();
    }
    // Zero-hex discipline (theme-token-discipline): the component styles only via theme tokens.
    const src = mcSource;
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  // ---- T-E2 (LOADING ≠ EMPTY ≠ OFFLINE) -------------------------------------------------------
  it('T-E2: resolved-null muted text is NOT a cold-load skeleton; no ⏸/offline caption exists in ANY state of this widget', () => {
    const states: (MarketContextPack | null)[] = [
      pack(),
      pack({ trend_momentum: null }),
      pack({ atr: atrRead({ atr_14d: null }) }),
      null,
    ];
    for (const s of states) {
      const { unmount } = renderMc(s);
      // EMPTY is muted text, never the shimmer class or a progressbar.
      expect(screen.queryByTestId('cold-skeleton')).toBeNull();
      expect(screen.queryByRole('progressbar')).toBeNull();
      // OFFLINE does not exist for this widget.
      expect(screen.queryByText(/⏸/)).toBeNull();
      expect(screen.queryByText(/offline/i)).toBeNull();
      unmount();
    }
    // The L5 empty is a real text element carrying the muted copy.
    renderMc(null);
    expect(screen.getByTestId('mc-whole-empty').textContent).toBe(MC_WHOLE_EMPTY);
  });

  // ---- T-E5 (labels never re-derived) ----------------------------------------------------------
  it('T-E5: a scalar/enum mismatch (adx 10 + label "strong") renders Strong — the wire enum wins; no FE threshold math', () => {
    renderMc(
      pack({
        trend_momentum: tiRead({
          strength: { label: 'strong', adx: 10, window: WIRE_DESC, thresholds: WIRE_DESC },
        }),
      }),
    );
    const row = screen.getByTestId('mc-strength');
    expect(within(row).getByText('Strong')).toBeInTheDocument(); // NOT re-bucketed to Weak
    expect(within(row).getByText('ADX(14) 10.0')).toBeInTheDocument(); // the scalar renders honestly
    expect(within(row).queryByText('Weak')).toBeNull();
  });

  // ---- Structural: no live/offline prop exists (the E-3 face; compile-time) --------------------
  it('E-3 (structural): the props are ONLY `pack` + optional `revealIndex` — no isLive/streamOffline/offline prop exists', () => {
    type P = ComponentProps<typeof MarketContext>;
    // Compile-time: every key of P is one of the two allowed names (fails to compile otherwise).
    const ok: keyof P extends 'pack' | 'revealIndex' ? true : false = true;
    expect(ok).toBe(true);
    // And the module CODE never touches the stream/watchdog seam (comments stripped — the doc
    // header legitimately NAMES the forbidden props to state the invariant).
    const src = mcSource;
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(
      /streamTicker|EventSource|streamOffline|isLive\b|payload-gap|watchdog/,
    );
  });
});

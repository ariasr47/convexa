/**
 * MarketContext — RISK-BASED widget spec (qa-verify.md §4, 2026-07-13). The page-level contract
 * (stream isolation, whole-section null matrix, wire-label-beats-scalar for trend direction) lives in
 * `pages/ticker/ticker.risk.spec.tsx`; this spec keeps ONLY the widget's own invariants where a silent
 * regression is plausible AND invisible:
 *   1. PARTIAL-object null tolerance (`best-effort-isolated-or-null`) — the five independent null
 *      LEVELS (per-label / per-ATR-horizon / per-sub-component / per-read / whole-pack) each degrade
 *      ONLY their own slot to its pinned copy (imported from `_kit/copy` — by construction, not
 *      re-typed wording), fabricate no 0/$0/%, and never throw.
 *   2. Unknown-enum closure at RENDER level — an unmapped wire token renders that label's unavailable
 *      state and the raw token never reaches the DOM (table totality/closure is unit-tested in
 *      `../_kit/copy.spec.ts`).
 *   3. Wire descriptor strings are never rendered — enforced by construction: every fixture descriptor
 *      field carries a sentinel that would fail the default render if leaked.
 * NOT asserted (visible + intentional → review): the 20-value label wording table, basis/tooltip/
 * advisory copy, digested-only structure (no table/chart), theme/hex scans, live-prop source scans
 * (the page-level byte-identity walk catches any live coupling behaviorally).
 *
 * Owner decision NO-1 A (2026-10-25): the band card is a summary and the 2×2 renders in the expand
 * overlay. The per-slot matrix runs in the overlay, where the slots live; the summary is held to the
 * same no-fabrication, no-raw-token and no-descriptor rules before the overlay opens.
 */
import { theme } from '@/shared/theme/theme';
import type {
  AtrRead,
  FlowVsPositioningRead,
  GexProfileShapeRead,
  MarketContextPack,
  TrendMomentumRead,
} from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  MC_ATR_EMPTY,
  MC_CELL_EMPTY,
  MC_FLOW_EMPTY,
  MC_LOCATION_ROW_EMPTY,
  MC_SHAPE_EMPTY,
  MC_TI_EMPTY,
  MC_TREND_ROW_EMPTY,
  MC_WHOLE_EMPTY,
} from '../_kit/copy';
import { MarketContext } from './MarketContext';

// ---- Fixtures. The wire `window`/`thresholds`/`flow_basis`/`method` descriptor strings carry a
// sentinel so ANY accidental FE render of them fails (the FE has its own pinned copy).
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

function renderMc(value: MarketContextPack | null) {
  return render(
    <ThemeProvider theme={theme}>
      <MarketContext pack={value} />
    </ThemeProvider>,
  );
}

/** Opens the card's expand overlay, where the 2×2 renders; returns queries scoped to it. */
async function expand() {
  await userEvent.setup().click(screen.getByRole('button', { name: 'Expand widget' }));
  return within(await screen.findByRole('dialog'));
}

// =================================================================================================
// 1. The five-level null matrix — each level degrades ONLY its own slot, fabricating nothing
//
// Ticker fidelity repair (F2, `design/src/screens/desk.mjs:43`): the compact card keeps exactly ONE
// headline row per family (Trend/direction, Shape/concentration, Flow/location, ATR/14-day) — the
// L1/L3 cases for the DROPPED rows (Strength, Momentum, Balance, Center-of-mass, Composition, ATR
// 5d/30d) are removed below (their testids no longer exist — there is nothing left to null); the
// KEPT rows' cases are unchanged in shape (same slot testid, same pinned copy), only their `intact`
// sibling probes are updated to values that still render post-repair (5d/30d ATR and the dropped
// enum labels are gone from the DOM regardless of what this fixture sets them to).
// =================================================================================================
interface NullCase {
  name: string;
  value: MarketContextPack | null;
  /** Where the pinned unavailable copy must appear. */
  slot: string;
  copy: string;
  /** Sibling probes that must STILL render (isolation). */
  intact: string[];
  /** Testids that must be GONE (whole-pack level only). */
  absent?: string[];
}

const MATRIX: NullCase[] = [
  // L1 — the TI family's one kept label, null (per-label).
  {
    name: 'L1 direction=null',
    value: pack({ trend_momentum: tiRead({ direction: null }) }),
    slot: 'mc-trend',
    copy: MC_TREND_ROW_EMPTY,
    intact: ['Concentrated', 'Rotating', '$3.87 · 2.2%'],
  },
  // L2 — the ATR family's one kept horizon, null (per-horizon).
  {
    name: 'L2 atr_14d=null',
    value: pack({ atr: atrRead({ atr_14d: null }) }),
    slot: 'mc-atr-14d',
    copy: MC_CELL_EMPTY,
    intact: ['Uptrend', 'Concentrated', 'Rotating'],
  },
  // L3 — the Flow family's one kept sub-component, null (per-sub-component).
  {
    name: 'L3 location=null',
    value: pack({ flow_vs_positioning: flowRead({ location: null }) }),
    slot: 'mc-location',
    copy: MC_LOCATION_ROW_EMPTY,
    intact: ['Uptrend', 'Concentrated', '$3.87 · 2.2%'],
  },
  // L4 — one whole read null (per-read).
  {
    name: 'L4 trend_momentum=null',
    value: pack({ trend_momentum: null }),
    slot: 'mc-ti',
    copy: MC_TI_EMPTY,
    intact: ['Concentrated', 'Rotating', '$3.87 · 2.2%'],
  },
  {
    name: 'L4 gex_profile_shape=null',
    value: pack({ gex_profile_shape: null }),
    slot: 'mc-shape',
    copy: MC_SHAPE_EMPTY,
    intact: ['Uptrend', 'Rotating', '$3.87 · 2.2%'],
  },
  {
    name: 'L4 flow_vs_positioning=null',
    value: pack({ flow_vs_positioning: null }),
    slot: 'mc-flow',
    copy: MC_FLOW_EMPTY,
    intact: ['Uptrend', 'Concentrated', '$3.87 · 2.2%'],
  },
  {
    name: 'L4 atr=null',
    value: pack({ atr: null }),
    slot: 'mc-atr',
    copy: MC_ATR_EMPTY,
    intact: ['Uptrend', 'Concentrated', 'Rotating'],
  },
  // L5 — the whole pack null (also the pre-feature missing-key shape: consumers pass `?? null`).
  {
    name: 'L5 whole pack null',
    value: null,
    slot: 'mc-whole-empty',
    copy: MC_WHOLE_EMPTY,
    intact: [],
    absent: ['mc-ti', 'mc-shape', 'mc-flow', 'mc-atr', 'mc-footer'],
  },
];

describe('MarketContext · five-level null matrix (best-effort-isolated-or-null)', () => {
  it.each(MATRIX)(
    '$name → only that slot degrades to its pinned copy; siblings intact; nothing fabricated',
    async ({ value, slot, copy, intact, absent }) => {
      expect(() => renderMc(value)).not.toThrow();

      // The band summary: never a fabricated zero, and no error/retry surface.
      expect(screen.queryByText(/\$0\b/)).toBeNull();
      expect(screen.queryByText(/retry|error/i)).toBeNull();

      const overlay = await expand();
      // The degraded slot carries its pinned unavailable copy…
      const el = overlay.getByTestId(slot);
      expect(within(el).getByText(copy)).toBeInTheDocument();
      // …and NO fabricated scalar took its place ($/%/decimal — "14-day" etc. survive this scan).
      expect(el.textContent ?? '').not.toMatch(/[$%]|\d\.\d/);

      // Isolation: the sibling probes still render their populated values.
      for (const probe of intact) expect(overlay.getByText(probe)).toBeInTheDocument();
      for (const id of absent ?? []) expect(overlay.queryByTestId(id)).toBeNull();

      // Never a fabricated zero anywhere, and no error/retry surface.
      expect(screen.queryByText(/\$0\b/)).toBeNull();
      expect(screen.queryByText(/retry|error/i)).toBeNull();
    },
  );
});

// =================================================================================================
// 2. Unknown-enum closure at render — honest fallback, raw token never in the DOM
// =================================================================================================
describe('MarketContext · unknown wire enum (closed-lookup wiring)', () => {
  it('renders that label’s unavailable state and never the raw token; siblings unaffected', async () => {
    // A label family WITH a pinned per-row empty sentence.
    const baseDirection = tiRead().direction;
    if (!baseDirection) throw new Error('tiRead fixture must carry a direction read');
    const r1 = renderMc(
      pack({
        trend_momentum: tiRead({
          direction: { ...baseDirection, label: 'sideways' as never },
        }),
      }),
    );
    // The band summary never shows the raw token either.
    expect(screen.queryByText(/sideways/i)).toBeNull();
    let overlay = await expand();
    expect(
      within(overlay.getByTestId('mc-trend')).getByText(MC_TREND_ROW_EMPTY),
    ).toBeInTheDocument();
    expect(screen.queryByText(/sideways/i)).toBeNull();
    // Sibling isolation (F2 — the compact card keeps only ONE row per family, so the sibling probe
    // is another family's kept headline, not the dropped Strength row).
    expect(within(overlay.getByTestId('mc-shape')).getByText('Concentrated')).toBeInTheDocument();
    r1.unmount();

    // A label family WITHOUT one (row label kept, muted value cell).
    renderMc(pack({ gex_profile_shape: shapeRead({ concentration_label: 'clustered' as never }) }));
    expect(screen.queryByText(/clustered/i)).toBeNull();
    overlay = await expand();
    expect(
      within(overlay.getByTestId('mc-concentration')).getByText(MC_CELL_EMPTY),
    ).toBeInTheDocument();
    expect(screen.queryByText(/clustered/i)).toBeNull();
  });
});

// =================================================================================================
// 3. Wire descriptors never rendered (sentinel, by construction)
// =================================================================================================
describe('MarketContext · wire descriptors', () => {
  it('the wire window/thresholds/flow_basis/method strings never reach the DOM', async () => {
    const { container } = renderMc(pack());
    expect(container.textContent ?? '').not.toContain(WIRE_DESC);
    await expand();
    expect(document.body.textContent ?? '').not.toContain(WIRE_DESC);
  });
});

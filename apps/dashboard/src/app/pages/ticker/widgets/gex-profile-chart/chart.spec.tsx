/**
 * `chart.tsx` — the surviving pure helpers (SPEC §2.3-adjacent) after GATE Z's FE-11 deletion of the
 * standalone `GexStrikeProfile`/`GexProfileChart`/`GexLegend` (see `chart.tsx`'s own module doc for
 * why the file survives that deletion). `windowedStrikes` moved here from the now-deleted
 * `GexStrikeProfile.spec.tsx` — it is NOT dead-widget test debt, it is the exact function
 * `structure-hero/StructureHeroPanel.tsx` calls to build its own `StructureFieldModel`, so a silent
 * regression here (walls dropped from the window, unsorted strikes) would render the desk's PRIMARY
 * structure instrument wrong, not merely a deleted secondary one.
 *
 * The former criterion-53 host-level "surfaces differ across schemes" proof (palette/surfaces
 * resolution) that used to live here against `GexProfileChart` is NOT dropped — it is ported onto
 * `StructureHeroPanel.spec.tsx` (the file that now owns that resolution in production), so criterion
 * 53's runtime coverage survives the widget's deletion. `hex-discipline.spec.ts`'s static scan is a
 * separate, still-independent check on raw hex literals.
 */
import type { StrikeRow } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import { rowsToSamples, windowedStrikes } from './chart';

const strike = (over: Partial<StrikeRow>): StrikeRow => ({
  strike: 250,
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

describe('windowedStrikes (pure windowing, shared by StructureHeroPanel)', () => {
  it('widens the ±10% spot window to always include the walls it labels, and sorts ascending', () => {
    // Walls OUTSIDE ±10% of spot 250 (225–275): put wall 200, call wall 300.
    const rows = [320, 300, 250, 200, 180].map((k) => strike({ strike: k }));
    const out = windowedStrikes(rows, 250, 300, 200);
    expect(out.map((s) => s.strike)).toEqual([200, 250, 300]); // walls kept, out-of-window dropped, sorted
  });

  it('non-positive walls fall back to the plain ±10% spot window', () => {
    const rows = [200, 230, 250, 270, 300].map((k) => strike({ strike: k }));
    const out = windowedStrikes(rows, 250, 0, 0);
    expect(out.map((s) => s.strike)).toEqual([230, 250, 270]); // 225–275 only
  });
});

describe('rowsToSamples (pure field mapping, shared by StructureHeroPanel)', () => {
  it('maps each strike row onto the field sample shape, one-to-one, in order', () => {
    const rows = [
      strike({ strike: 240, net_gex: -1e6, net_dex: 2e5, vol_oi_ratio: 0.4, volume: 100 }),
      strike({ strike: 260, net_gex: 3e6, net_dex: null, vol_oi_ratio: null, volume: null }),
    ];
    expect(rowsToSamples(rows)).toEqual([
      { strike: 240, netGex: -1e6, netDex: 2e5, volOi: 0.4, volume: 100 },
      { strike: 260, netGex: 3e6, netDex: null, volOi: null, volume: null },
    ]);
  });
});

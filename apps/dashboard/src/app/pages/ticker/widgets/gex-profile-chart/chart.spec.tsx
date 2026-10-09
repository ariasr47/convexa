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
 * resolution) moved from here to `StructureHeroPanel.spec.tsx` and was removed there in lean-tests
 * batch 48; criterion 53 now rests on `hex-discipline.spec.ts`'s static scan of raw hex literals.
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

describe('windowedStrikes (pure windowing, shared by StructureHeroPanel — repair task item 3)', () => {
  it('windows on the walls themselves — max(1.5% of spot, 25% of the wall span) — not a flat ±10% spot band', () => {
    // Walls 200/300 → span 100, pad = max(250*0.015=3.75, 100*0.25=25) = 25 → window [175, 325].
    const rows = [340, 320, 300, 250, 200, 180, 150].map((k) => strike({ strike: k }));
    const out = windowedStrikes(rows, 250, 300, 200);
    expect(out.map((s) => s.strike)).toEqual([180, 200, 250, 300, 320]); // 175–325, sorted
  });

  it('a tight wall span still gets the 1.5%-of-spot floor, not a vanishingly small pad', () => {
    // Walls 248/252 → span 4, 25% of span = 1, 1.5% of spot 250 = 3.75 → pad = 3.75 → [244.25, 255.75].
    const rows = [240, 244, 246, 248, 252, 254, 256, 260].map((k) => strike({ strike: k }));
    const out = windowedStrikes(rows, 250, 252, 248);
    expect(out.map((s) => s.strike)).toEqual([246, 248, 252, 254]);
  });

  it('widens only as far as needed to keep gammaFlip and maxPain inside the window', () => {
    // Base window (walls 300/200, pad 25) is [175, 325]; a flip at 160 and max pain at 340 sit
    // outside it and must pull the bounds out to include them — nothing more.
    const rows = [340, 320, 300, 250, 200, 180, 160, 150].map((k) => strike({ strike: k }));
    const out = windowedStrikes(rows, 250, 300, 200, 160, 340);
    expect(out.map((s) => s.strike)).toEqual([160, 180, 200, 250, 300, 320, 340]);
  });

  it('non-positive walls fall back to the plain ±10% spot window (unchanged case)', () => {
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

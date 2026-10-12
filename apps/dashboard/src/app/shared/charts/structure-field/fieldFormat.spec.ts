/**
 * `fmtM` (the probe label's `net GEX`/`DEX` figure and the axis `±$` caps) and `gexAt` (the
 * net-GEX lookup every field line, particle and probe reads) — exact outputs at their boundaries.
 *
 * Both functions exist TWICE, byte-identical today: `paintStep.ts` (the Canvas2D field the ticker
 * desk paints) and `structureFieldShared.ts` (re-exported by `index.ts` for the lab WebGL field).
 * Each table runs against both copies so the two renderers cannot drift into printing different
 * numbers for one strike.
 *
 * Expected values are hand-derived from the unit branches (K = 1e3 → 0 dp, M = 1e6 → 1 dp,
 * B = 1e9 → 2 dp; linear interpolation between adjacent samples, clamped at both ends). Inputs
 * avoid unit-rollover ties (999.5 → `1000`, 999_500 → `1000K`) and the `-0` a small negative
 * prints: what those SHOULD read is an open owner question (lean-tests batch 103).
 */
import { describe, expect, it } from 'vitest';
import * as paintStep from './paintStep';
import * as shared from './structureFieldShared';

interface FieldFormat {
  fmtM: (v: number) => string;
  gexAt: (samples: { strike: number; netGex: number }[], strike: number) => number;
}

const COPIES: Array<[string, FieldFormat]> = [
  ['paintStep', paintStep],
  ['structureFieldShared', shared],
];

describe.each(COPIES)('%s · fmtM', (_name, mod) => {
  it.each<[number, string]>([
    [0, '0'],
    [999, '999'],
    [1_000, '1K'],
    [-1_000, '-1K'],
    [1_499, '1K'],
    [999_499, '999K'],
    [1_000_000, '1.0M'],
    [-2_500_000, '-2.5M'],
    [1_000_000_000, '1.00B'],
    [-1_234_000_000, '-1.23B'],
  ])('fmtM(%d) → %s', (v, out) => {
    expect(mod.fmtM(v)).toBe(out);
  });
});

describe.each(COPIES)('%s · gexAt', (_name, mod) => {
  const SAMPLES = [
    { strike: 100, netGex: -200 },
    { strike: 110, netGex: 300 },
    { strike: 130, netGex: 100 },
  ];

  it('returns 0 for an empty sample set (no field, no invented value)', () => {
    expect(mod.gexAt([], 105)).toBe(0);
  });

  it.each<[number, number]>([
    [90, -200], // below the first strike → clamped to the first sample
    [100, -200], // exactly on a sample
    [105, 50], // halfway 100→110: −200 + 500 × 0.5
    [110, 300], // exactly on an interior sample
    [125, 150], // three-quarters 110→130: 300 − 200 × 0.75
    [130, 100], // exactly on the last sample
    [140, 100], // above the last strike → clamped to the last sample
  ])('gexAt(samples, %d) → %d', (strike, out) => {
    expect(mod.gexAt(SAMPLES, strike)).toBe(out);
  });
});

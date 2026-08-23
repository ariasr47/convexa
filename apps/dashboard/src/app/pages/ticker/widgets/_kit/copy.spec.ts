/**
 * copy.ts — RISK-BASED unit tests (qa-verify.md §4, 2026-07-13). Pure logic only, no DOM. We keep the
 * invariants where a silent regression is plausible AND invisible to a reviewer:
 *   - formatter NUMERIC semantics: bucket boundaries, sign-first figure-minus (U+2212), null → honest
 *     em-dash (never a fabricated $0), the ×100 fraction→percent scale;
 *   - date parsing: UTC calendar semantics (no TZ drift) + raw-string fallback (never blank);
 *   - the closed lookup tables: TOTALITY (every enum member maps) + CLOSURE (unknown / prototype-chain
 *     tokens fall to the honest null), table-driven — one test for ALL maps, not one per label;
 *   - ivrBasisLine's closed branch: an unknown basis fails honest (no fabricated DTE claim);
 *   - humanAge bucketing (s/m/h/d) — previously untested pure logic.
 * NOT asserted (visible + intentional → review): the wording of labels/tooltips/basis lines,
 * pluralization niceties, tooltip copy builders.
 */
import { describe, expect, it } from 'vitest';
import {
  fmtSigned2,
  fmtSignedUsdCompact,
  fmtUsdCompact,
  gexProfileSubtitle,
  humanAge,
  humanOpex,
  humanSessionDate,
  IVR_BAND_DISPLAY,
  ivrBandDisplay,
  ivrBasisLine,
  LIVE_TAPE_SUBTITLE_LIVE,
  LIVE_TAPE_SUBTITLE_OFFLINE,
  MC_BALANCE_DISPLAY,
  MC_COMPOSITION_DISPLAY,
  MC_CONCENTRATION_DISPLAY,
  MC_DIRECTION_DISPLAY,
  MC_LOCATION_DISPLAY,
  MC_MOMENTUM_DISPLAY,
  MC_STRENGTH_DISPLAY,
  mcComLine,
  mcDisplay,
  structureAsOfPhrase,
  withStructureAge,
} from './copy';

describe('fmtUsdCompact — numeric semantics', () => {
  it('scales into the right bucket at the ≥ boundaries, and null is the honest em-dash (never $0)', () => {
    expect(fmtUsdCompact(null)).toBe('—');
    expect(fmtUsdCompact(1e9)).toBe('$1.0B');
    expect(fmtUsdCompact(999_999_999)).toBe('$1000.0M'); // just under 1e9 stays $M
    expect(fmtUsdCompact(1e6)).toBe('$1.0M');
    expect(fmtUsdCompact(1e3)).toBe('$1.0K');
    expect(fmtUsdCompact(420)).toBe('$420');
    expect(fmtUsdCompact(36_607_000_000)).toBe('$36.6B');
  });

  it('sign is FIRST and the figure minus (U+2212) — never "$-"; the signed variants inherit it', () => {
    for (const v of [-420, -12_300, -12_300_000, -36_607_000_000]) {
      expect(fmtUsdCompact(v).startsWith('−$')).toBe(true);
      expect(fmtUsdCompact(v).includes('$-')).toBe(false);
    }
    // fmtSignedUsdCompact: explicit + on positives, 0 unsigned, null still the em-dash.
    expect(fmtSignedUsdCompact(4_200_000)).toBe('+$4.2M');
    expect(fmtSignedUsdCompact(-1_900_000)).toBe('−$1.9M');
    expect(fmtSignedUsdCompact(0)).toBe('$0');
    expect(fmtSignedUsdCompact(null)).toBe('—');
    // fmtSigned2: the balance scalar's explicit sign, same figure minus.
    expect(fmtSigned2(0.34)).toBe('+0.34');
    expect(fmtSigned2(-0.34)).toBe('−0.34');
    expect(fmtSigned2(-0.34).includes('-')).toBe(false);
  });

  it('mcComLine renders the wire FRACTION ×100 with an explicit sign (the silent ×100 regression)', () => {
    expect(mcComLine(0.012)).toBe('+1.2% vs spot');
    expect(mcComLine(-0.0301)).toBe('−3.0% vs spot');
    expect(mcComLine(0)).toBe('+0.0% vs spot');
  });
});

describe('humanOpex / humanSessionDate — UTC calendar parse', () => {
  it('parses as a UTC calendar date (no TZ drift on the date) and falls back to the raw string, never blank/invented', () => {
    expect(humanOpex('2026-07-17')).toBe('Fri Jul 17');
    expect(humanOpex('2026-01-16')).toBe('Fri Jan 16');
    expect(humanSessionDate('2026-07-03')).toBe(humanOpex('2026-07-03')); // the neutral alias stays an alias
    // Malformed input → the raw input, never blank, never a fabricated date.
    expect(humanOpex('not-a-date')).toBe('not-a-date');
    expect(humanOpex('2026/07/17')).toBe('2026/07/17');
    expect(humanOpex('')).toBe('');
  });
});

describe('closed lookup tables — totality + closure (one table-driven test for ALL maps)', () => {
  const LOOKUPS: Array<[name: string, map: Record<string, string>]> = [
    ['direction', MC_DIRECTION_DISPLAY],
    ['strength', MC_STRENGTH_DISPLAY],
    ['momentum', MC_MOMENTUM_DISPLAY],
    ['concentration', MC_CONCENTRATION_DISPLAY],
    ['balance', MC_BALANCE_DISPLAY],
    ['location', MC_LOCATION_DISPLAY],
    ['composition', MC_COMPOSITION_DISPLAY],
    ['iv-rank band', IVR_BAND_DISPLAY],
  ];

  it('every enum member maps to a non-empty display string; unknown + prototype-chain tokens → null (honest fallback)', () => {
    for (const [name, map] of LOOKUPS) {
      const lookup = (t: string) =>
        map === IVR_BAND_DISPLAY ? ivrBandDisplay(t) : mcDisplay(map, t);
      // Totality: each member maps, and never to a raw snake_case pass-through.
      for (const token of Object.keys(map)) {
        const display = lookup(token);
        expect(display, `${name}.${token}`).toBeTruthy();
        expect(display, `${name}.${token}`).not.toMatch(/_/);
      }
      // Closure: unknown / empty / prototype-chain tokens fall to null — never invented, never raw.
      for (const bad of ['__unknown__', '', 'toString', 'hasOwnProperty']) {
        expect(lookup(bad), `${name} closure on "${bad}"`).toBeNull();
      }
    }
  });
});

describe('ivrBasisLine — closed basis branch', () => {
  it('nearest_tenor carries its honest DTE; an UNKNOWN basis degrades to the clean wording with NO fabricated DTE claim', () => {
    expect(ivrBasisLine(130, 252, 130, 'nearest_tenor', 23)).toContain('~23d');
    const unknown = ivrBasisLine(130, 252, 130, 'weird_basis', 23);
    expect(unknown).not.toContain('23d'); // no fabricated tenor claim
    // Identical to the clean branch regardless of the (ignored) DTE — closed, not interpolating.
    expect(unknown).toBe(ivrBasisLine(130, 252, 130, 'interpolated_30d', 999));
  });
});

describe('humanAge — bucketing', () => {
  it('buckets seconds into s / m / h+m / d+h and never fabricates an age on null', () => {
    expect(humanAge(null)).toBe('unknown age');
    expect(humanAge(45)).toBe('45s');
    expect(humanAge(90)).toBe('1m');
    expect(humanAge(3_700)).toBe('1h 1m');
    expect(humanAge(242_779)).toBe('2d 19h');
  });
});

describe('product spine #4 — structure age + basis phrases', () => {
  it('structureAsOfPhrase names basis and age; never claims live', () => {
    expect(structureAsOfPhrase(42)).toBe('Structure as-of 42s');
    expect(structureAsOfPhrase(null)).toBe('Structure as-of unknown age');
    expect(structureAsOfPhrase(Number.NaN)).toBe('Structure as-of unknown age');
    expect(structureAsOfPhrase(42)).not.toMatch(/\blive\b/i);
  });

  it('withStructureAge appends age or an honest snapshot tag', () => {
    expect(withStructureAge('ATM IV by tenor · contango', 90)).toBe(
      'ATM IV by tenor · contango · Structure as-of 1m',
    );
    expect(withStructureAge('basis only', null)).toBe('basis only · structure snapshot');
  });

  it('gexProfileSubtitle carries spot basis, window, and age', () => {
    const s = gexProfileSubtitle(250.5, 'all expirations', 30);
    expect(s).toMatch(/GEX spot \$250\.50/);
    expect(s).toMatch(/all expirations/);
    expect(s).toMatch(/Structure as-of 30s/);
    expect(s).toMatch(/not live/i);
    expect(s).not.toMatch(/\blive stream\b/i);
  });

  it('live-tape subtitles name stream vs structure isolation', () => {
    expect(LIVE_TAPE_SUBTITLE_LIVE).toMatch(/live stream/i);
    expect(LIVE_TAPE_SUBTITLE_LIVE).toMatch(/structure/i);
    expect(LIVE_TAPE_SUBTITLE_OFFLINE).toMatch(/structure/i);
    expect(LIVE_TAPE_SUBTITLE_OFFLINE).toMatch(/offline/i);
  });
});

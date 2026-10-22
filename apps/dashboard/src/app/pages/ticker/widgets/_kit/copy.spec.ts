/**
 * copy.ts — RISK-BASED unit tests (qa-verify.md §4, 2026-07-13). Pure logic only, no DOM. We keep the
 * invariants where a silent regression is plausible AND invisible to a reviewer:
 *   - formatter NUMERIC semantics: bucket boundaries, sign-first figure-minus (U+2212), null → honest
 *     em-dash (never a fabricated $0);
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
  fmtAsOfEt,
  fmtExpiry,
  fmtSigned2,
  fmtSignedUsdCompact,
  fmtUsdCompact,
  humanAge,
  humanOpex,
  humanSessionDate,
  IVR_BAND_DISPLAY,
  ivrBandDisplay,
  ivrBasisLine,
  MC_CONCENTRATION_DISPLAY,
  MC_DIRECTION_DISPLAY,
  MC_LOCATION_DISPLAY,
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
    ['concentration', MC_CONCENTRATION_DISPLAY],
    ['location', MC_LOCATION_DISPLAY],
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
});

// =================================================================================================
// Fidelity repair 2, N5 — fmtAsOfEt / fmtExpiry: one as-of / expiration formatter, exchange clock.
// Fixed clocks (never `Date.now()` inside a test), both sides of a DST transition, null/unparseable
// input.
// =================================================================================================
describe('fmtAsOfEt — "HH:MM:SS ET · <age>", the exchange clock (fidelity repair 2, N5)', () => {
  it('EST side (January, UTC-5) — the design’s own example: 15:41:52Z is 10:41:52 ET, 48s later', () => {
    const iso = '2026-01-15T15:41:52.000Z';
    const now = Date.parse(iso) + 48_000;
    expect(fmtAsOfEt(iso, now)).toBe('10:41:52 ET · 48s');
  });

  it('EDT side (July, UTC-4) — the SAME wall-clock example reads the same HH:MM:SS via the other offset', () => {
    const iso = '2026-07-15T14:41:52.000Z'; // UTC-4 in EDT -> 10:41:52 local
    const now = Date.parse(iso) + 48_000;
    expect(fmtAsOfEt(iso, now)).toBe('10:41:52 ET · 48s');
  });

  it('age is computed via humanAge (bucketed), not re-derived — a multi-minute gap buckets the same way', () => {
    const iso = '2026-01-15T15:41:52.000Z';
    const now = Date.parse(iso) + 125_000; // 2m 5s
    expect(fmtAsOfEt(iso, now)).toBe(`10:41:52 ET · ${humanAge(125)}`);
  });

  it('null / unparseable renders the closed-vocabulary member, never the raw string', () => {
    expect(fmtAsOfEt(null, 0)).toBe('unavailable');
    expect(fmtAsOfEt(undefined, 0)).toBe('unavailable');
    expect(fmtAsOfEt('not-a-timestamp', 0)).toBe('unavailable');
  });
});

describe('fmtExpiry — "Mon D (N DTE)", never negative, the exchange calendar date (fidelity repair 2, N5)', () => {
  it('the design’s own example: Sep 18 from a Sep 3 clock is 15 DTE', () => {
    expect(fmtExpiry('2026-09-18', Date.parse('2026-09-03T15:00:00.000Z'))).toBe('Sep 18 (15 DTE)');
  });

  it('never negative — same-day or already-passed expirations floor at 0 DTE', () => {
    expect(fmtExpiry('2026-09-18', Date.parse('2026-09-18T20:00:00.000Z'))).toBe('Sep 18 (0 DTE)');
    expect(fmtExpiry('2026-09-18', Date.parse('2026-09-25T15:00:00.000Z'))).toBe('Sep 18 (0 DTE)');
  });

  it('DST-spanning window — 14 calendar days stays 14 DTE across the March transition (2026-03-08), never 13 or 15 from the 23-hour day', () => {
    expect(fmtExpiry('2026-03-15', Date.parse('2026-03-01T12:00:00.000Z'))).toBe('Mar 15 (14 DTE)');
  });

  it('the exchange (ET) calendar date, not the UTC date, decides DTE — a UTC instant that is still yesterday in ET counts from yesterday', () => {
    // 2026-01-01T04:30:00Z is 2025-12-31T23:30 EST — the ET calendar date is Dec 31, not Jan 1.
    expect(fmtExpiry('2026-01-02', Date.parse('2026-01-01T04:30:00.000Z'))).toBe('Jan 2 (2 DTE)');
  });

  it('null / unparseable renders the closed-vocabulary member, never the raw string', () => {
    expect(fmtExpiry(null, 0)).toBe('unavailable');
    expect(fmtExpiry(undefined, 0)).toBe('unavailable');
    expect(fmtExpiry('not-a-date', 0)).toBe('unavailable');
  });
});

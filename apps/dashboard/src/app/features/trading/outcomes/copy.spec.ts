/**
 * outcome-ledger — the COPY BUILDERS' invariants (not their wording: wording is verified by review,
 * per the risk-based rule). What is asserted here is the structural stuff a refactor could silently
 * break: the one-string inseparability rule, the strict >20pp threshold, the exhaustive reason
 * lookup, and the negative space (no `$`, no "expectancy").
 */
import { describe, expect, it } from 'vitest';
import {
  cellLines,
  TR_REASON_LABEL,
  trBuilding,
  trCountedBasis,
  trCountedRead,
  trIsStillWide,
} from './copy';
import { EXCLUSION_PRECEDENCE } from './types';

describe('the counted read is ONE STRING (AC-8, AC-9 — §2.4)', () => {
  const read = trCountedRead(58, { lo: 36, hi: 78 }, 24, 12.44, 31.2);

  it('the builder emits no rate without its range, its N, its mean per-trade return AND its dispersion', () => {
    // One builder, one string: there is no code path that emits any PART of this, so there is no
    // `&&` anyone can add that would render a rate alone. A hit rate is trivially gamed by many
    // small wins and few large losses — a hit-rate-only read is a defect, not a smaller feature.
    expect(read).toContain('58% hit rate');
    expect(read).toContain('plausibly 36–78%'); // AC-11: a plain range, never a bare ±
    expect(read).toContain('24 closed trades');
    expect(read).toContain('avg +12.4% per trade');
    expect(read).toContain('±31pts trade to trade');
  });

  it('the basis line carries the window AND the basis, and appends the partiality onto the same mandatory sibling', () => {
    const basis = trCountedBasis('2026-03-04T00:00:00.000Z', '2026-07-15T00:00:00.000Z', true);
    expect(basis).toContain('quoted fills only');
    expect(basis).toMatch(/2026/); // the window carries the YEAR (it is all-time; it spans years)
    expect(trCountedBasis('2026-03-04T00:00:00.000Z', '2026-07-15T00:00:00.000Z', false)).toContain(
      '· partial read',
    );
  });

  it('AC-10 / AC-16 — negative space: no `$` and no "expectancy" anywhere in a counted read', () => {
    const all = [
      read,
      trCountedBasis('2026-03-04T00:00:00.000Z', '2026-07-15T00:00:00.000Z', false),
      trBuilding(7, 20),
    ].join(' ');
    expect(all).not.toContain('$');
    expect(all.toLowerCase()).not.toContain('expectancy');
  });

  it('the mean renders signed, with a REAL minus sign — never a hyphen', () => {
    expect(trCountedRead(40, { lo: 20, hi: 60 }, 20, -3.1, 12)).toContain('avg −3.1% per trade');
  });

  it('a `building` cohort yields ONE line and NOTHING numeric beside it — no rate, no range, no mean, no window, no basis', () => {
    const lines = cellLines({ state: 'building', n: 3, n_min: 20 }, true);
    expect(lines.read).toBe(trBuilding(3, 20));
    expect(lines.qualifier).toBeNull();
    expect(lines.basis).toBeNull();
    // AC-E3: the 3-for-3 trap. Neither string can be produced from a building cohort.
    expect(lines.read).not.toContain('100%');
    expect(lines.read).not.toContain('3 of 3 won');
  });

  it('a `computed` cohort always yields BOTH the read line and the basis line — neither is conditional', () => {
    const lines = cellLines(
      {
        state: 'computed',
        hit_rate: 58,
        interval: { lo: 36, hi: 78 },
        n: 24,
        mean_pl_pct: 12.4,
        stdev_pl_pct: 31,
        window: { first: '2026-03-04T00:00:00.000Z', last: '2026-07-15T00:00:00.000Z' },
        basis_class: 'quoted',
      },
      true,
    );
    expect(lines.read).toBeTruthy();
    expect(lines.basis).toBeTruthy();
  });
});

describe('AC-12 — the "still wide" threshold is STRICTLY > 20pp', () => {
  it('21pp wide ⇒ the qualifier; exactly 20.0pp ⇒ it does NOT render', () => {
    expect(trIsStillWide({ lo: 36, hi: 57 })).toBe(true); // 21pp
    expect(trIsStillWide({ lo: 36, hi: 56 })).toBe(false); // exactly 20.0pp — no qualifier
    expect(trIsStillWide({ lo: 40, hi: 55 })).toBe(false); // 15pp
  });

  it('the width test is computed from the EMITTED interval, so the rendered range and the qualifier can never disagree', () => {
    const cohort = {
      state: 'computed',
      hit_rate: 58,
      interval: { lo: 36, hi: 78 },
      n: 24,
      mean_pl_pct: 12.4,
      stdev_pl_pct: 31,
      window: { first: '2026-03-04T00:00:00.000Z', last: '2026-07-15T00:00:00.000Z' },
      basis_class: 'quoted',
    } as const;
    expect(cellLines(cohort, true).qualifier).toBe('still wide — not a conclusion yet');
    expect(cellLines({ ...cohort, interval: { lo: 36, hi: 56 } }, true).qualifier).toBeNull();
  });
});

describe('AC-18 — the reason lookup is EXHAUSTIVE', () => {
  it('every reason key maps to a plain label (a missing key would silently vanish a count)', () => {
    for (const reason of EXCLUSION_PRECEDENCE) {
      expect(TR_REASON_LABEL[reason]).toBeTruthy();
    }
    expect(Object.keys(TR_REASON_LABEL).sort()).toEqual([...EXCLUSION_PRECEDENCE].sort());
  });
});

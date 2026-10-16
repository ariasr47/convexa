/**
 * The FOMC outcome table is copied by hand from the Fed's statements, so a slip (a wrong range, a
 * cut entered as a hold, a row on the wrong day) would draw a false decision on the 2s10s lane
 * without any error. These checks hold the rows to each other and to the dates table.
 */
import { describe, expect, it } from 'vitest';
import {
  FOMC_DECISIONS,
  FOMC_OUTCOMES,
  FOMC_OUTCOMES_CHECKED,
  fomcOutcome,
  outcomeLabel,
  outcomeWords,
} from './fomc';

describe('FOMC outcome table', () => {
  it('has one row for every scheduled decision up to its check date, and no other', () => {
    const due = FOMC_DECISIONS.filter(
      (m) => m.date >= FOMC_OUTCOMES[0].date && m.date <= FOMC_OUTCOMES_CHECKED,
    ).map((m) => m.date);
    expect(FOMC_OUTCOMES.map((o) => o.date)).toEqual(due);
  });

  it('chains: each range is the previous one moved by the stated change, a quarter point wide', () => {
    for (const [i, o] of FOMC_OUTCOMES.entries()) {
      expect(o.range[1] - o.range[0]).toBeCloseTo(0.25, 9);
      if (i === 0) continue;
      const prev = FOMC_OUTCOMES[i - 1];
      expect(o.range[0]).toBeCloseTo(prev.range[0] + o.moveBp / 100, 9);
    }
  });

  it('cites each decision’s own statement', () => {
    for (const o of FOMC_OUTCOMES) {
      expect(o.statement).toBe(
        `https://www.federalreserve.gov/newsevents/pressreleases/monetary${o.date.replaceAll('-', '')}a.htm`,
      );
    }
  });

  it('labels with a true minus, Hold for no change, and never guesses a missing decision', () => {
    const at = (d: string) => fomcOutcome(d) as NonNullable<ReturnType<typeof fomcOutcome>>;
    expect(outcomeLabel(at('2025-12-10'))).toBe('−25');
    expect(outcomeLabel(at('2024-09-18'))).toBe('−50');
    expect(outcomeLabel(at('2026-07-29'))).toBe('Hold');
    expect(outcomeLabel(at('2026-09-16'))).toBe('+25');
    expect(outcomeWords(at('2026-09-16'))).toBe('raised 25 bp to 3.75–4.00%');
    expect(outcomeWords(at('2026-01-28'))).toBe('held at 3.50–3.75%');
    // Scheduled but after the check date: no row, so no label.
    expect(fomcOutcome('2026-10-28')).toBeNull();
  });
});

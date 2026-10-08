/**
 * FigureClause.spec.tsx — fidelity repair 2, N5 follow-up (conductor-requested).
 *
 * N5 itself left this site named-but-untouched (`FIDELITY_REPAIR_2_REPORT.md`'s N5 "Not touched"
 * note): the `inside_range` clause interpolates the wire's raw `YYYY-MM-DD` expiration directly —
 * the review's own evidence quote names this exact phrase ("inside Convexa's implied move for
 * 2026-09-18 (490–520)"), still present in the produced-read panel. `figureClause()` (`literals.ts`)
 * has ALREADY decided `inside_range` from the raw wire token (state/basis/range_low/range_high/
 * expiration) before this component ever sees a value — the same closed-selector-decides-first
 * discipline N5 applied in `DecisionCard.tsx` / `AnalysisSurface.tsx` — so only the resolved
 * expiration's TEXT is reformatted here, never the selector itself.
 */
import { theme } from '@/shared/theme/theme';
import type { GroundingField } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FigureClause } from './FigureClause';

afterEach(() => cleanup());

/** The review's own fixture: `inside_range`, expiration 2026-09-18, range 490–520. */
function insideRangeField(overrides: Partial<GroundingField> = {}): GroundingField {
  return {
    state: 'traced',
    basis: 'inside_range',
    anchor_kind: null,
    anchor_value: null,
    range_low: 490,
    range_high: 520,
    expiration: '2026-09-18',
    not_checkable_reason: null,
    ...overrides,
  };
}

function renderClause(field: GroundingField | null | undefined) {
  return render(
    <ThemeProvider theme={theme}>
      <FigureClause field={field} testId="clause-target" />
    </ThemeProvider>,
  );
}

describe('FigureClause — inside_range formats its expiration, never raw (fidelity repair 2, N5 follow-up)', () => {
  it('the raw ISO expiration is absent; the "Sep 18 (15 DTE)" form is present — the review\'s own example, fixed clock', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-09-03T15:00:00.000Z'));
    try {
      renderClause(insideRangeField());
      const clause = screen.getByTestId('clause-target');
      expect(clause.textContent ?? '').not.toContain('2026-09-18');
      expect(clause).toHaveTextContent(
        "inside Convexa's implied move for Sep 18 (15 DTE) (490–520)",
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

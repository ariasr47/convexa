/**
 * ai-rec.absence.spec.tsx — rec-absence-literals-hole (PLAN F9). The card render rule for unnamed
 * fields: on a trade card, a slot the AI never named shows a closed absence word — never the reserved
 * mark (`—`, which means "not applicable"), a blank, null/undefined/NaN or the raw token.
 *
 * Renders `DecisionCard` + an open `AnalysisSurface` directly with the presentation the real policy
 * derives (`deriveAiRecPresentation`); the PAYLOAD FIXTURE is the only input — never a mocked
 * selector or copy table. No App/network mount.
 *
 * `fieldValueEl` is the shipped label-anchored traversal (F0.3): no per-field `data-testid` exists on
 * the card, so a label-anchored DOM walk is the only honest mechanism. Time horizon and Confidence resolve through the analysis surface's own field testids.
 */
import { theme } from '@/shared/theme/theme';
import type { RecResponse } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalysisSurface } from './AnalysisSurface';
import { COPY, PLAN_FIELD_LABEL } from './copy';
import { DecisionCard } from './DecisionCard';
import { recBlankValues, recNoFieldReasonsBlock, recNoneNamed } from './fixtures';
import { deriveAiRecPresentation } from './presentationPolicy';

afterEach(cleanup);

function renderCardAndAnalysis(rec: RecResponse) {
  const presentation = deriveAiRecPresentation({
    rec,
    loading: false,
    stale: false,
    signedIn: true,
    canCreateOrder: true,
    inAppEnabled: true,
    cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-27T04:00:00Z' },
    cooldownRemaining: 0,
    readinessGateState: 'available',
    scenarioSelected: false,
    currentRiskInputs: null,
  });
  return render(
    <ThemeProvider theme={theme}>
      <DecisionCard
        rec={rec}
        bundle={null}
        presentation={presentation}
        dataAge="older data"
        onReview={vi.fn()}
        onCreateOrder={vi.fn()}
        onAnalysis={vi.fn()}
        onRefresh={vi.fn()}
        onDismiss={vi.fn()}
      />
      <AnalysisSurface
        open
        ticker="TSLA"
        rec={rec}
        bundle={null}
        onClose={vi.fn()}
        onViewExport={vi.fn()}
      />
    </ThemeProvider>,
  );
}

const card = () => screen.getByTestId('ai-rec-decision-card');

/** The shipped, proven traversal for a `Field`-shaped label/value pair, scoped to the card. */
function fieldValueEl(label: string): HTMLElement {
  const labelEl = within(card()).getByText(label);
  const fieldBox = labelEl.closest('div')?.parentElement as HTMLElement;
  const value = fieldBox.querySelector('p');
  if (!value) throw new Error(`no value <p> found for field "${label}"`);
  return value as HTMLElement;
}

/** Resolves any of the six plan/conviction slots by label; Time horizon and Confidence read from the
 *  open analysis surface. */
function slotValueEl(label: string): HTMLElement {
  if (label === PLAN_FIELD_LABEL.timeHorizon || label === PLAN_FIELD_LABEL.confidence) {
    return screen.getByTestId(`analysis-field-${label}`);
  }
  return fieldValueEl(label);
}

const RESERVED = '—';
const CLOSED_ABSENCE_WORDS = ['not given', 'unavailable', 'unrecognized'];
const SIX = Object.values(PLAN_FIELD_LABEL);
const RISK_LABELS = [COPY.risk.maxRisk, COPY.risk.invalidation, 'Entry', 'Target'];

describe('rec-absence-literals-hole · the card (F9)', () => {
  it.each([
    {
      name: 'AC-1 (SB) — nothing named',
      makeRec: recNoneNamed,
      exact: null as string | null,
    },
    {
      name: 'AC-5 (SB) — no field_reasons block at all',
      makeRec: recNoFieldReasonsBlock,
      exact: 'not given',
    },
    {
      name: 'AC-7 (SB) — blank-ish values ("", whitespace, [])',
      makeRec: recBlankValues,
      exact: 'not given',
    },
  ])(
    'an unnamed slot shows a closed absence word, never the reserved mark, a blank, null/NaN or a raw token: $name',
    ({ makeRec, exact }) => {
      renderCardAndAnalysis(makeRec());
      let resolved = 0;
      for (const label of SIX) {
        const text = slotValueEl(label).textContent ?? '';
        resolved++;
        expect(text.trim().length).toBeGreaterThan(0);
        expect(text).not.toContain(RESERVED);
        expect(CLOSED_ABSENCE_WORDS).toContain(text);
        if (exact) expect(text).toBe(exact);
      }
      expect(resolved).toBe(6);
      for (const label of RISK_LABELS) {
        const text = fieldValueEl(label).textContent ?? '';
        expect(text.trim().length).toBeGreaterThan(0);
        expect(text).not.toContain(RESERVED);
      }
      const cardText = card().textContent ?? '';
      expect(cardText).not.toContain('null');
      expect(cardText).not.toContain('undefined');
      expect(cardText).not.toContain('NaN');
      expect(within(card()).getByTestId('rec-not-actionable')).toBeInTheDocument();
    },
  );
});

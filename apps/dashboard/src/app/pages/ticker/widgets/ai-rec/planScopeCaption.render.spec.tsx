import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalysisSurface } from './AnalysisSurface';
import { DecisionCard } from './DecisionCard';
import { PLAN_FIELDS_NOT_CHECKED, REASONING_PROSE_NOT_CHECKED } from './copy';
import { noTradeRec, recAllTraced, recLocalRules, recLocalRulesNothingCheckable } from './fixtures';
import type { AiRecPresentation } from './presentationPolicy';

afterEach(cleanup);

const actions = (o: Partial<AiRecPresentation['actions']> = {}) => ({
  directExport: false,
  analyze: false,
  askAnyway: false,
  retry: false,
  settings: false,
  signIn: false,
  reviewTrade: true,
  createOrder: true,
  analysis: true,
  refresh: false,
  dismiss: true,
  ...o,
});
const pres = (o: Partial<AiRecPresentation> = {}): AiRecPresentation => ({
  requestState: 'idle',
  resultState: 'fresh_trade',
  missingPositionFields: [],
  actions: actions(),
  ...o,
});

function renderCardAndAnalysis(rec: ReturnType<typeof recAllTraced>, presentation = pres()) {
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

describe('plan-scope caption · DOM integration (AC-1+2+2r+3+5)', () => {
  it('AC-1 — exactly one caption with exact copy on non-local_rules trade', () => {
    renderCardAndAnalysis(recAllTraced());
    const nodes = screen.getAllByTestId('plan-fields-not-checked');
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toHaveTextContent(PLAN_FIELDS_NOT_CHECKED);
    expect(screen.getByTestId('ai-rec-decision-card').contains(nodes[0])).toBe(true);
  });

  it('AC-2 — local_rules + shared_admin → zero instances on card and open analysis', () => {
    const rec = recLocalRules();
    rec.key_source = 'shared_admin';
    rec.remaining_free_uses = 2;
    renderCardAndAnalysis(rec);
    expect(screen.queryByTestId('plan-fields-not-checked')).toBeNull();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('AC-2r — not_applicable still shows exactly one caption', () => {
    renderCardAndAnalysis(recLocalRulesNothingCheckable());
    expect(screen.getAllByTestId('plan-fields-not-checked')).toHaveLength(1);
  });

  it('AC-3 — analysis open never duplicates; prose caption remains distinct', () => {
    const rec = recAllTraced();
    rec.strategy!.rationale = 'Thesis lead. Detail.';
    renderCardAndAnalysis(rec);
    expect(screen.getAllByTestId('plan-fields-not-checked')).toHaveLength(1);
    const prose = screen.getByTestId('reasoning-prose-not-checked');
    expect(prose).toHaveTextContent(REASONING_PROSE_NOT_CHECKED);
    expect(prose.textContent).not.toBe(PLAN_FIELDS_NOT_CHECKED);
  });

  it('AC-5 — no_trade → absent', () => {
    renderCardAndAnalysis(
      noTradeRec(),
      pres({
        resultState: 'no_trade',
        actions: actions({ reviewTrade: false, createOrder: false }),
      }),
    );
    expect(screen.queryByTestId('plan-fields-not-checked')).toBeNull();
  });

  it('AC-8 — re-render / parent update leaves caption and plan values unchanged', () => {
    const rec = recAllTraced();
    const view = renderCardAndAnalysis(rec);
    const beforeCaption = screen.getByTestId('plan-fields-not-checked').textContent;
    const beforeMeta = screen.getByTestId('decision-metadata').textContent;
    view.rerender(
      <ThemeProvider theme={theme}>
        <DecisionCard
          rec={rec}
          bundle={null}
          presentation={pres()}
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
    expect(screen.getByTestId('plan-fields-not-checked').textContent).toBe(beforeCaption);
    expect(screen.getByTestId('decision-metadata').textContent).toBe(beforeMeta);
  });
});

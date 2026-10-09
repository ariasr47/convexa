import { makeBundle } from '@/features/auth/testBackend';
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalysisSurface } from './AnalysisSurface';
import { recAllTraced } from './fixtures';

afterEach(cleanup);

function renderSurface(overrides: Partial<React.ComponentProps<typeof AnalysisSurface>> = {}) {
  const props: React.ComponentProps<typeof AnalysisSurface> = {
    open: true,
    ticker: 'TSLA',
    rec: recAllTraced(),
    bundle: null,
    onClose: vi.fn(),
    onViewExport: vi.fn(),
    ...overrides,
  };
  return render(
    <ThemeProvider theme={theme}>
      <AnalysisSurface {...props} />
    </ThemeProvider>,
  );
}

describe('AnalysisSurface', () => {
  it('AC-2 partial data uses closed literals or omission and never renders a reserved em dash', () => {
    const rec = recAllTraced();
    const sent = rec.sent!;
    const riskInputs = sent.risk_inputs!;
    const openPositions = sent.open_positions!;
    rec.as_of = null;
    rec.strategy!.structure = null;
    rec.strategy!.expiration = null;
    rec.strategy!.time_horizon = null;
    rec.strategy!.confidence = null;
    rec.field_reasons = {
      ...rec.field_reasons!,
      structure: { reason: 'not_given', missing_input: null },
      expiration: { reason: 'not_given', missing_input: null },
      time_horizon: { reason: 'not_given', missing_input: null },
      confidence: { reason: 'not_given', missing_input: null },
    };
    riskInputs.account_size = null;
    riskInputs.per_trade_cap = null;
    riskInputs.effective_dollar_cap.value = null;
    riskInputs.effective_dollar_cap.derived_from = {
      account_size: null,
      cap_value: null,
      cap_unit: null,
    };
    openPositions.this_underlying = null;
    renderSurface({ rec });
    const summary = screen.getByTestId('analysis-summary');
    const inputs = screen.getByTestId('as-sent-inputs');
    expect(summary).toHaveTextContent('not given');
    expect(summary.textContent).not.toContain('—');
    expect(inputs.textContent).not.toContain('—');
    expect(inputs).toHaveTextContent('State: set');
    expect(inputs).toHaveTextContent('State: none_open');
  });

  it('uses the closed risk-field literals and suppresses grounding clauses for absent figures', () => {
    const rec = recAllTraced();
    rec.strategy!.exit_plan = { stop: null, target: null };
    rec.strategy!.invalidation_level = null;
    rec.field_reasons = {
      ...rec.field_reasons!,
      exit_stop: { reason: 'not_given', missing_input: null },
      exit_target: { reason: 'unavailable', missing_input: 'risk_block' },
      invalidation_level: { reason: 'not_given', missing_input: null },
    };
    renderSurface({ rec });
    const fields = screen.getByTestId('analysis-grounding-fields');
    expect(within(fields).getAllByText('not given')).toHaveLength(2);
    expect(within(fields).getByText('not set')).toBeInTheDocument();
    expect(within(fields).queryByTestId('clause-stop')).toBeNull();
    expect(within(fields).queryByTestId('clause-target')).toBeNull();
    expect(within(fields).queryByTestId('clause-invalidation')).toBeNull();
  });

  it('renders grounding clauses beside present stop, target, and invalidation values', () => {
    renderSurface({ rec: recAllTraced() });
    const fields = screen.getByTestId('analysis-grounding-fields');
    expect(within(fields).getByTestId('clause-stop')).toBeInTheDocument();
    expect(within(fields).getByTestId('clause-target')).toBeInTheDocument();
    expect(within(fields).getByTestId('clause-invalidation')).toBeInTheDocument();
  });

  it('renders every supplied as-sent leaf, including closed absence reasons', () => {
    const rec = recAllTraced();
    rec.sent!.risk_inputs.effective_dollar_cap.not_derivable_reason =
      'percent_without_account_size';
    rec.sent!.risk_inputs.effective_dollar_cap.derived_from = {
      account_size: null,
      cap_value: 2,
      cap_unit: 'percent',
    };
    rec.sent!.open_positions.this_underlying = {
      direction: 'long',
      leg_count: 2,
      nearest_expiry_dte: 14,
      max_loss: { state: 'ineligible', value: null, reason: 'multi-leg' },
    };
    renderSurface({ rec });
    const section = screen.getByTestId('as-sent-inputs');
    expect(section).toHaveTextContent('percent_without_account_size');
    expect(section).toHaveTextContent('cap 2 percent');
    expect(section).toHaveTextContent('reason: multi-leg');
  });

  it('reopens the same pinned read without mutation or request/export activity', async () => {
    const user = userEvent.setup();
    const rec = recAllTraced();
    const bundle = makeBundle();
    const beforeRec = structuredClone(rec);
    const beforeBundle = structuredClone(bundle);
    const callbacks = { close: vi.fn(), export: vi.fn() };
    function Harness() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open pinned analysis</button>
          <AnalysisSurface
            open={open}
            ticker="TSLA"
            rec={rec}
            bundle={bundle}
            onClose={() => {
              callbacks.close();
              setOpen(false);
            }}
            onViewExport={callbacks.export}
          />
        </>
      );
    }
    render(
      <ThemeProvider theme={theme}>
        <Harness />
      </ThemeProvider>,
    );
    const opener = screen.getByRole('button', { name: 'Open pinned analysis' });
    await user.click(opener);
    const first = screen.getByTestId('analysis-summary').textContent;
    const rationale = screen.getByTestId('reasoning-prose-not-checked').textContent;
    await user.click(screen.getByRole('button', { name: 'Close analysis' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await user.click(opener);
    expect(screen.getByTestId('analysis-summary').textContent).toBe(first);
    expect(screen.getByTestId('reasoning-prose-not-checked').textContent).toBe(rationale);
    expect(rec).toEqual(beforeRec);
    expect(bundle).toEqual(beforeBundle);
    expect(callbacks.close).toHaveBeenCalledTimes(1);
    expect(callbacks.export).not.toHaveBeenCalled();
  });
});

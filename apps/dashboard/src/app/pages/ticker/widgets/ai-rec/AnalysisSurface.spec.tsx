import { makeBundle } from '@/features/auth/testBackend';
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalysisSurface } from './AnalysisSurface';
import { noTradeRec, recAllTraced } from './fixtures';

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
  it('orders summary, rationale, management, levels, evidence, inputs and export', () => {
    const rec = recAllTraced();
    rec.strategy!.key_points = ['Support holds'];
    rec.strategy!.reengage_when = ['If support breaks'];
    renderSurface({ rec, bundle: makeBundle() });
    const dialog = screen.getByRole('dialog', { name: 'Full analysis & data · TSLA' });
    const ordered = [
      'analysis-summary',
      'analysis-rationale',
      'analysis-levels',
      'analysis-numbers',
      'analysis-cited',
      'analysis-grounding',
      'analysis-cap',
      'analysis-as-sent',
      'analysis-export',
    ].map((id) => within(dialog).getByTestId(id));
    ordered
      .slice(1)
      .forEach((node, i) =>
        expect(
          ordered[i].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy(),
      );
    expect(within(dialog).getByText('As-sent risk inputs')).toBeInTheDocument();
  });

  it('renders full rationale and partial data without throwing', () => {
    const rec = recAllTraced();
    rec.strategy!.rationale = 'First sentence. Second sentence with detail.';
    renderSurface({ rec, bundle: null });
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Second sentence with detail.')).toBeInTheDocument();
  });

  it('renders no-trade summary without trade-only assumptions', () => {
    renderSurface({ rec: noTradeRec() });
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('No trade — sit this one out')).toBeInTheDocument();
    expect(within(dialog).getByText('As-sent risk inputs')).toBeInTheDocument();
  });

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

  it('renders incomplete, pre-grounding, and scripted pinned responses safely', () => {
    const incomplete = recAllTraced();
    incomplete.strategy!.structure = null;
    incomplete.strategy!.strikes = [];
    incomplete.strategy!.expiration = null;
    const preGrounding = recAllTraced();
    delete preGrounding.grounding;
    const scripted = recAllTraced();
    scripted.scenario = { id: 'scenario-1', name: 'Breakout rehearsal' };
    const cases = [incomplete, preGrounding, scripted];
    cases.forEach((rec) => {
      const { unmount } = renderSurface({ rec, bundle: makeBundle() });
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveTextContent(
        rec === scripted ? 'SCRIPTED SCENARIO · Breakout rehearsal' : 'Read summary',
      );
      expect(dialog).toHaveTextContent('As-sent risk inputs');
      unmount();
    });
  });

  it('keeps full rationale before Why and re-engagement in expanded mode', () => {
    const rec = recAllTraced();
    rec.strategy!.rationale = 'Pinned lead. Full rationale detail.';
    rec.strategy!.key_points = ['Why this level matters'];
    rec.strategy!.reengage_when = ['Manage when support breaks'];
    renderSurface({ rec, bundle: makeBundle() });
    const reasoning = screen.getByTestId('analysis-rationale');
    const nodes = [
      within(reasoning).getByTestId('reasoning-full-read'),
      within(reasoning).getByTestId('reasoning-key-points'),
      within(reasoning).getByTestId('reasoning-reengage'),
    ];
    nodes
      .slice(1)
      .forEach((node, i) =>
        expect(
          nodes[i].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy(),
      );
    expect(within(nodes[0]).getByText('Full rationale detail.')).toBeInTheDocument();
  });

  it('closes before invoking export', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onViewExport = vi.fn();
    function Harness() {
      const [open, setOpen] = React.useState(true);
      return (
        <AnalysisSurface
          open={open}
          ticker="TSLA"
          rec={recAllTraced()}
          bundle={makeBundle()}
          onClose={() => {
            onClose();
            setOpen(false);
          }}
          onViewExport={() => {
            expect(screen.queryByRole('dialog')).toBeNull();
            onViewExport();
          }}
        />
      );
    }
    render(
      <ThemeProvider theme={theme}>
        <Harness />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'What’s sent to the AI' }));
    await waitFor(() => expect(onViewExport).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('moves initial focus into the surface and traps Tab and Shift+Tab', async () => {
    const user = userEvent.setup();
    renderSurface();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Close analysis' })).toHaveFocus();
    await user.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.tab({ shift: true });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('closes on Escape and returns focus to the opener', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Full analysis &amp; data</button>
          <AnalysisSurface
            open={open}
            ticker="TSLA"
            rec={recAllTraced()}
            bundle={null}
            onClose={() => setOpen(false)}
            onViewExport={vi.fn()}
          />
        </>
      );
    }
    render(
      <ThemeProvider theme={theme}>
        <Harness />
      </ThemeProvider>,
    );
    const opener = screen.getByRole('button', { name: 'Full analysis & data' });
    await user.click(opener);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(opener).toHaveFocus());
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

  it('does not render when the pinned response is absent or not produced', () => {
    const onClose = vi.fn();
    const { rerender } = renderSurface({ open: false, onClose });
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(
      <ThemeProvider theme={theme}>
        <AnalysisSurface
          open
          ticker="TSLA"
          rec={{ ...recAllTraced(), status: 'unavailable', strategy: null }}
          bundle={null}
          onClose={vi.fn()}
          onViewExport={vi.fn()}
        />
      </ThemeProvider>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes an open surface when its pinned result disappears and does not reopen on replacement', async () => {
    const onClose = vi.fn();
    const { rerender } = renderSurface({ onClose });
    rerender(
      <ThemeProvider theme={theme}>
        <AnalysisSurface
          open
          ticker="TSLA"
          rec={null}
          bundle={null}
          onClose={onClose}
          onViewExport={vi.fn()}
        />
      </ThemeProvider>,
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    rerender(
      <ThemeProvider theme={theme}>
        <AnalysisSurface
          open={false}
          ticker="TSLA"
          rec={recAllTraced()}
          bundle={makeBundle()}
          onClose={onClose}
          onViewExport={vi.fn()}
        />
      </ThemeProvider>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps a single vertical scroll region', () => {
    renderSurface();
    expect(screen.getByTestId('analysis-content')).toHaveStyle({
      overflowY: 'auto',
      overflowX: 'hidden',
    });
    expect(screen.getAllByTestId('analysis-content')).toHaveLength(1);
  });
});

// =================================================================================================
// Fidelity repair 2, N5 — the drawer's "As of" and the structured summary's expiration are
// formatted, never the raw ISO/date string.
// =================================================================================================
describe('AnalysisSurface — as-of and expiration are formatted, never raw (fidelity repair 2, N5)', () => {
  it('the raw ISO as_of string is absent from analysis-summary; the "HH:MM:SS ET" form is present', () => {
    renderSurface({ rec: recAllTraced() });
    const summary = screen.getByTestId('analysis-summary');
    expect(summary.textContent).not.toContain('2026-06-26T14:00:00Z');
    expect(summary.textContent).toMatch(/As of \d{2}:\d{2}:\d{2} ET/);
  });

  it('the raw expiration date string is absent from analysis-structured-summary; the "Mon D (N DTE)" form is present', () => {
    renderSurface({ rec: recAllTraced() });
    const structured = screen.getByTestId('analysis-structured-summary');
    expect(structured.textContent).not.toContain('2026-07-18');
    expect(structured.textContent).toMatch(/Jul \d+ \(\d+ DTE\)/);
  });

  it('the cited-contract line (analysis-cited) formats its expiration — the raw date string is absent', () => {
    renderSurface({ rec: recAllTraced() });
    const cited = screen.getByTestId('analysis-cited');
    expect(cited.textContent).not.toContain('2026-07-18');
    expect(cited.textContent).toMatch(/Jul \d+ \(\d+ DTE\)/);
  });
});

// =================================================================================================
// Fidelity repair 2, N6 — the drawer lists "Time horizon" exactly once (in the plan fields, beside
// Confidence), never twice (it was ALSO in the structured summary, alongside Structure/Expiration).
// =================================================================================================
describe('AnalysisSurface — "Time horizon" renders exactly once (fidelity repair 2, N6)', () => {
  it('exactly one "Time horizon" label in the drawer, inside analysis-plan-fields (beside Confidence) — none in analysis-structured-summary', () => {
    renderSurface({ rec: recAllTraced() });
    expect(screen.getAllByText('Time horizon')).toHaveLength(1);
    const structured = screen.getByTestId('analysis-structured-summary');
    expect(within(structured).queryByText('Time horizon')).toBeNull();
    const planFields = screen.getByTestId('analysis-plan-fields');
    expect(within(planFields).getByText('Time horizon')).toBeInTheDocument();
    expect(within(planFields).getByText('Confidence')).toBeInTheDocument();
  });

  it('the structured summary keeps Structure and Expiration (only Time horizon dropped)', () => {
    renderSurface({ rec: recAllTraced() });
    const structured = screen.getByTestId('analysis-structured-summary');
    expect(within(structured).getByText('Structure')).toBeInTheDocument();
    expect(within(structured).getByText('Expiration')).toBeInTheDocument();
  });
});

import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import * as React from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { recAllTraced, noTradeRec } from './fixtures';
import { AnalysisSurface } from './AnalysisSurface';
import { makeBundle } from '@/features/auth/testBackend';

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
  return render(<ThemeProvider theme={theme}><AnalysisSurface {...props} /></ThemeProvider>);
}

describe('AnalysisSurface', () => {
  it('orders summary, rationale, management, levels, evidence, inputs and export', () => {
    const rec = recAllTraced();
    rec.strategy!.key_points = ['Support holds'];
    rec.strategy!.reengage_when = ['If support breaks'];
    renderSurface({ rec, bundle: makeBundle() });
    const dialog = screen.getByRole('dialog', { name: 'Full analysis & data · TSLA' });
    const ordered = ['analysis-summary', 'analysis-rationale', 'analysis-levels', 'analysis-numbers', 'analysis-cited', 'analysis-grounding', 'analysis-cap', 'analysis-as-sent', 'analysis-export'].map((id) => within(dialog).getByTestId(id));
    ordered.slice(1).forEach((node, i) => expect(ordered[i].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy());
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

  it('renders every supplied as-sent leaf, including closed absence reasons', () => {
    const rec = recAllTraced();
    rec.sent!.risk_inputs.effective_dollar_cap.not_derivable_reason = 'percent_without_account_size';
    rec.sent!.risk_inputs.effective_dollar_cap.derived_from = { account_size: null, cap_value: 2, cap_unit: 'percent' };
    rec.sent!.open_positions.this_underlying = { direction: 'long', leg_count: 2, nearest_expiry_dte: 14, max_loss: { state: 'ineligible', value: null, reason: 'multi-leg' } };
    renderSurface({ rec });
    const section = screen.getByTestId('as-sent-inputs');
    expect(section).toHaveTextContent('percent_without_account_size');
    expect(section).toHaveTextContent('cap 2 percent');
    expect(section).toHaveTextContent('reason: multi-leg');
  });

  it('closes before invoking export', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onViewExport = vi.fn();
    function Harness() {
      const [open, setOpen] = React.useState(true);
      return <AnalysisSurface open={open} ticker="TSLA" rec={recAllTraced()} bundle={makeBundle()} onClose={() => { onClose(); setOpen(false); }} onViewExport={() => { expect(screen.queryByRole('dialog')).toBeNull(); onViewExport(); }} />;
    }
    render(<ThemeProvider theme={theme}><Harness /></ThemeProvider>);
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
      return <><button onClick={() => setOpen(true)}>Full analysis &amp; data</button><AnalysisSurface open={open} ticker="TSLA" rec={recAllTraced()} bundle={null} onClose={() => setOpen(false)} onViewExport={vi.fn()} /></>;
    }
    render(<ThemeProvider theme={theme}><Harness /></ThemeProvider>);
    const opener = screen.getByRole('button', { name: 'Full analysis & data' });
    await user.click(opener);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(opener).toHaveFocus();
  });

  it('does not render when the pinned response is absent or not produced', () => {
    const onClose = vi.fn();
    const { rerender } = renderSurface({ open: false, onClose });
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<ThemeProvider theme={theme}><AnalysisSurface open ticker="TSLA" rec={{ ...recAllTraced(), status: 'unavailable', strategy: null }} bundle={null} onClose={vi.fn()} onViewExport={vi.fn()} /></ThemeProvider>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes an open surface when its pinned result disappears and does not reopen on replacement', async () => {
    const onClose = vi.fn();
    const { rerender } = renderSurface({ onClose });
    rerender(<ThemeProvider theme={theme}><AnalysisSurface open ticker="TSLA" rec={null} bundle={null} onClose={onClose} onViewExport={vi.fn()} /></ThemeProvider>);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    rerender(<ThemeProvider theme={theme}><AnalysisSurface open={false} ticker="TSLA" rec={recAllTraced()} bundle={makeBundle()} onClose={onClose} onViewExport={vi.fn()} /></ThemeProvider>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps a single vertical scroll region', () => {
    renderSurface();
    expect(screen.getByTestId('analysis-content')).toHaveStyle({ overflowY: 'auto', overflowX: 'hidden' });
    expect(screen.getAllByTestId('analysis-content')).toHaveLength(1);
  });
});

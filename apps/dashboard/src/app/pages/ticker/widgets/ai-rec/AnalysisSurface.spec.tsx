import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import * as React from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { recAllTraced, noTradeRec } from './fixtures';
import { AnalysisSurface } from './AnalysisSurface';

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
    renderSurface({ rec, bundle: { market_state: { call_wall: 250 } } as never });
    const dialog = screen.getByRole('dialog', { name: 'Full analysis & data · TSLA' });
    const text = dialog.textContent ?? '';
    expect(text.indexOf('Read summary')).toBeLessThan(text.indexOf('Why'));
    expect(text.indexOf('Why')).toBeLessThan(text.indexOf('Levels in play'));
    expect(text.indexOf('Levels in play')).toBeLessThan(text.indexOf('What’s sent to the AI'));
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

  it('closes before invoking export', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onViewExport = vi.fn();
    renderSurface({ onClose, onViewExport });
    await user.click(screen.getByRole('button', { name: 'What’s sent to the AI' }));
    expect(onClose).toHaveBeenCalledBefore(onViewExport);
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
      const openerRef = React.useRef<HTMLButtonElement>(null);
      return <><button ref={openerRef} onClick={() => setOpen(true)}>Full analysis &amp; data</button><AnalysisSurface open={open} ticker="TSLA" rec={recAllTraced()} bundle={null} onClose={() => { setOpen(false); openerRef.current?.focus(); }} onViewExport={vi.fn()} /></>;
    }
    render(<ThemeProvider theme={theme}><Harness /></ThemeProvider>);
    const opener = screen.getByRole('button', { name: 'Full analysis & data' });
    await user.click(opener);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(opener).toHaveFocus();
  });

  it('does not render when the pinned response is absent or not produced', () => {
    const { rerender } = renderSurface({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<ThemeProvider theme={theme}><AnalysisSurface open ticker="TSLA" rec={{ ...recAllTraced(), status: 'unavailable', strategy: null }} bundle={null} onClose={vi.fn()} onViewExport={vi.fn()} /></ThemeProvider>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps a single vertical scroll region', () => {
    renderSurface();
    expect(screen.getByTestId('analysis-content')).toHaveStyle({ overflowY: 'auto', overflowX: 'hidden' });
    expect(screen.getAllByTestId('analysis-content')).toHaveLength(1);
  });
});

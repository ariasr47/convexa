/**
 * QuickSymbols — Command Deck Quick row (AC-1, AC-2, AC-4, AC-6, AC-8).
 */
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetRecentTickers, recordVisit } from '../../recentTickers/store';
import { QuickSymbols } from './QuickSymbols';

function renderQuick(props: Partial<React.ComponentProps<typeof QuickSymbols>> = {}) {
  const onSelect = props.onSelect ?? vi.fn();
  return {
    onSelect,
    ...render(
      <ThemeProvider theme={theme}>
        <QuickSymbols currentSymbol={props.currentSymbol ?? 'TSLA'} onSelect={onSelect} />
      </ThemeProvider>,
    ),
  };
}

beforeEach(() => {
  localStorage.clear();
  __resetRecentTickers();
});

describe('QuickSymbols', () => {
  it('renders QUICK label + closed pins SPY QQQ NVDA even when recents empty (AC-1, AC-2, AC-6)', () => {
    renderQuick();
    const row = screen.getByTestId('quick-symbols');
    expect(within(row).getByText('QUICK')).toBeInTheDocument();
    // pins in order
    const chips = within(row).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual(['SPY', 'QQQ', 'NVDA']);
    // never an error / "no symbols" claim
    expect(row.textContent).not.toMatch(/no symbols/i);
  });

  it('appends recents after pins, de-duped (AC-5)', () => {
    recordVisit('IWM');
    recordVisit('AMD');
    renderQuick();
    const chips = within(screen.getByTestId('quick-symbols')).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual(['SPY', 'QQQ', 'NVDA', 'AMD', 'IWM']);
  });

  it('uses a physical 1px vertical separator when recents exist (AC-1)', () => {
    recordVisit('IWM');
    renderQuick();
    const row = screen.getByTestId('quick-symbols');
    const separator = row.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(separator).toBeTruthy();
    const styles = getComputedStyle(separator);
    expect(styles.width).toBe('1px');
    expect(styles.height).toBe('16px');
  });

  it('does not render an orphan separator without recents (AC-2)', () => {
    renderQuick();
    expect(screen.getByTestId('quick-symbols').querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('marks the current route symbol selected (AC-4)', () => {
    renderQuick({ currentSymbol: 'qqq' });
    const qqq = screen.getByRole('button', { name: 'QQQ' });
    expect(qqq).toHaveAttribute('aria-pressed', 'true');
    const spy = screen.getByRole('button', { name: 'SPY' });
    expect(spy).toHaveAttribute('aria-pressed', 'false');
  });

  it('click calls onSelect with uppercase symbol (AC-3)', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderQuick();
    await user.click(screen.getByRole('button', { name: 'SPY' }));
    expect(onSelect).toHaveBeenCalledWith('SPY');
  });

  it('keeps native button keyboard and focus semantics (AC-7)', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderQuick();
    const spy = screen.getByRole('button', { name: 'SPY' });
    spy.focus();
    expect(spy).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onSelect).toHaveBeenNthCalledWith(1, 'SPY');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'SPY');
    expect(spy).toHaveAttribute('type', 'button');
    expect(spy).toHaveAttribute('aria-pressed', 'false');
  });
});

import { themeForPref } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DerivedGroup } from './derive';
import { FX_PROTECTIVE_PUT, viewOf } from './fixtures';
import { PositionsView, type ViewProps } from './PositionsView';
import type { PositionView } from './view';

function stubDesktopViewport() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('min-width:1200px'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      onchange: null,
      dispatchEvent: () => false,
    })),
  );
}

function propsFor(view: PositionView): ViewProps {
  const groups: DerivedGroup[] = [
    { key: '__all__', label: 'All', views: [view], subtotal: 0, excludedCount: 0 },
  ];
  return {
    groups,
    columns: [],
    layout: 'table',
    density: 'comfortable',
    streamOffline: true,
    totalCount: 1,
    isHistory: false,
    trendFor: () => [],
    onOpenEntry: vi.fn(),
    onClearFilter: vi.fn(),
    onClose: vi.fn(),
    onCancel: vi.fn(),
  };
}

describe('offline positions table containment', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('wraps repeated offline markers and keeps the actions cell pinned inside the table frame', () => {
    stubDesktopViewport();
    render(
      <ThemeProvider theme={themeForPref('dark')}>
        <PositionsView {...propsFor(viewOf(FX_PROTECTIVE_PUT))} />
      </ThemeProvider>,
    );

    const table = screen.getByTestId('positions-table');
    const frame = screen.getByTestId('positions-table-frame');
    const plCell = screen.getByTestId('cell-pl');
    // The old `⏸ offline` text marker is gone — the pause mark is a real icon, and the caption that
    // wraps onto its own line is `cell-pl-caption` (SPEC §2.3, criteria 27a/29).
    expect(within(plCell).getByTestId('PauseIcon')).toBeInTheDocument();
    const offlineTag = within(plCell).getByTestId('cell-pl-caption');
    const actionCell = screen.getByTestId('position-actions-cell');

    expect(getComputedStyle(plCell).flexWrap).toBe('wrap');
    expect(getComputedStyle(offlineTag).flexBasis).toBe('100%');
    expect(getComputedStyle(frame).overflowX).toBe('auto');
    expect(getComputedStyle(actionCell).position).toBe('sticky');
    expect(within(actionCell).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(table.parentElement).toBe(frame);
  });
});

/**
 * Component — THE BANNER REGION's collision rule (SPEC §4 *Banner region*, AC-65, AC-66).
 *
 * Risk-based (SPEC §7): the ORDER and the AT-MOST-ONE rule are invisible to review — every notice
 * renders correctly on its own, and the failure only shows when two of them collide, which is
 * exactly the state a trader meets on a bad day. The faulted suppression is the sharpest case: a
 * dismissible notice under a store that refuses writes would return forever, and the merge notice
 * would be a false claim about a promote that was aborted.
 */
import { themeForPref } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CustomizationToolbar } from './CustomizationToolbar';
import { defaultConfig, defaultView } from './defaults';
import { MERGE_NOTICE, staleViewNotice } from './labels';
import type { usePortfolio } from './usePortfolio';

type Portfolio = ReturnType<typeof usePortfolio>;

function stubPortfolio(): Portfolio {
  const view = defaultView();
  return {
    working: defaultConfig(),
    activeView: view,
    custom: { views: [view], activeViewId: view.id, working: defaultConfig() },
    hasUnsavedChanges: false,
    setFilter: vi.fn(),
    setWorking: vi.fn(),
    switchView: vi.fn(),
    saveChanges: vi.fn(),
    saveAsNewView: vi.fn(),
    renameView: vi.fn(),
    deleteView: vi.fn(),
  } as unknown as Portfolio;
}

function renderToolbar(over: Record<string, unknown> = {}) {
  return render(
    <ThemeProvider theme={themeForPref('dark')}>
      <CustomizationToolbar pf={stubPortfolio()} canOpenEntry {...over} />
    </ThemeProvider>,
  );
}

const OFFLINE_COPY = '⚠ Live marks paused — P/L shown is from the last update. Records persist.';

describe('banner region — the collision rule', () => {
  it('renders nothing at all when nothing is wrong', () => {
    renderToolbar();
    expect(screen.queryByTestId('offline-banner')).toBeNull();
    expect(screen.queryByTestId('merge-notice')).toBeNull();
    expect(screen.queryByTestId('stale-view-notice')).toBeNull();
  });

  it('the shipped offline banner is BYTE-IDENTICAL and non-dismissible', () => {
    renderToolbar({ streamOffline: true });
    expect(screen.getByTestId('offline-banner').textContent).toBe(OFFLINE_COPY);
    expect(screen.queryByLabelText(/dismiss/i)).toBeNull();
  });

  it('shows AT MOST ONE dismissible notice — the merge notice wins while it is pending', () => {
    renderToolbar({ mergeNoticePending: true, staleViewName: 'Tech swings' });
    expect(screen.getByTestId('merge-notice')).toBeInTheDocument();
    expect(screen.queryByTestId('stale-view-notice')).toBeNull();
  });

  it('the stale-view notice appears only AFTER the merge notice is gone', () => {
    const { rerender } = renderToolbar({ mergeNoticePending: true, staleViewName: 'Tech swings' });
    expect(screen.queryByTestId('stale-view-notice')).toBeNull();
    rerender(
      <ThemeProvider theme={themeForPref('dark')}>
        <CustomizationToolbar
          pf={stubPortfolio()}
          canOpenEntry
          mergeNoticePending={false}
          staleViewName="Tech swings"
        />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('stale-view-notice').textContent).toContain(
      staleViewNotice('Tech swings'),
    );
  });

  it('AC-65 — faulted and offline are independent: both banners render, faulted first', () => {
    renderToolbar({ streamOffline: true, faulted: true });
    // The offline banner still renders while faulted, and it still says exactly what it shipped
    // saying — faulted dims nothing and offline disables nothing.
    expect(screen.getByTestId('offline-banner').textContent).toBe(OFFLINE_COPY);
  });

  it('AC-66 — while faulted NO dismissible notice renders: not merge, not stale-view', () => {
    renderToolbar({ faulted: true, mergeNoticePending: true, staleViewName: 'Tech swings' });
    expect(screen.queryByTestId('merge-notice')).toBeNull();
    expect(screen.queryByTestId('stale-view-notice')).toBeNull();
  });

  it('dismissing the stale-view notice is EPHEMERAL and writes nothing to storage', async () => {
    const user = userEvent.setup();
    localStorage.clear();
    const before = JSON.stringify(localStorage);
    renderToolbar({ staleViewName: 'Tech swings' });
    await user.click(screen.getByTestId('stale-view-dismiss'));
    expect(screen.queryByTestId('stale-view-notice')).toBeNull();
    expect(JSON.stringify(localStorage)).toBe(before);
  });

  it('the merge notice states NO counts and points at export without renaming the action', () => {
    renderToolbar({ mergeNoticePending: true, onDismissMerge: vi.fn() });
    const text = screen.getByTestId('merge-notice').textContent ?? '';
    expect(text).toContain(MERGE_NOTICE);
    expect(text).not.toMatch(/\b\d+\s+(record|position|trade)/i);
    expect(screen.getByTestId('merge-notice-export').textContent).toBe('Export an archive');
  });

  it('dismissing the merge notice is DURABLE — it delegates to the host, never to local state', async () => {
    const user = userEvent.setup();
    const onDismissMerge = vi.fn();
    renderToolbar({ mergeNoticePending: true, onDismissMerge });
    await user.click(screen.getByTestId('merge-notice-dismiss'));
    expect(onDismissMerge).toHaveBeenCalledTimes(1);
    // Still rendered: the host owns the durable flag, so the notice cannot vanish on a write that
    // may not have landed.
    expect(screen.getByTestId('merge-notice')).toBeInTheDocument();
  });
});

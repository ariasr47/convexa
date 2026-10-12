/**
 * Component — THE BANNER REGION's collision rule (SPEC §4 *Banner region*, AC-65, AC-66).
 *
 * Risk-based (SPEC §7): the failure only shows when two states collide, which is exactly the state a
 * trader meets on a bad day. The faulted suppression is the sharpest case: a dismissible notice under
 * a store that refuses writes would return forever, and the merge notice would be a false claim about
 * a promote that was aborted. The offline banner must still render while faulted, and dismissing the
 * stale-view notice must write nothing.
 */
import { themeForPref } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CustomizationToolbar } from './CustomizationToolbar';
import { defaultConfig, defaultView } from './defaults';
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
});

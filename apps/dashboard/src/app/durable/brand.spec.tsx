/**
 * rebrand-convexa — brand-string assertions (FRONTEND_EXECUTION_CONTRACT §D.4). AC-B1 (no stray live
 * "GammaFlow" on landing / nav wordmark) + AC-B2 (both export filename stems begin `convexa-`, never
 * `gammaflow-`). Mocks ONLY the network boundary; no live backend.
 */
import { render, screen, within, cleanup } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';

import Landing from '../landing/Landing';
import { AppShell } from '../shell/AppShell';
import { exportLog } from '../ghost-trade/store';
import { useLatencyTrend } from '../operator-metrics/useLatencyTrend';

const theme = createTheme();

vi.mock('@org/api', async (orig) => {
  const actual = await orig<typeof import('@org/api')>();
  return { ...actual, fetchMetrics: vi.fn(async () => { throw new Error('no backend in test'); }) };
});

function renderRoute(ui: React.ReactNode, initial = '/') {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[initial]}>{ui}</MemoryRouter>
    </ThemeProvider>,
  );
}

/** Capture the `download` attribute of the anchor a download action creates. */
function captureDownload(action: () => void): string {
  const realCreate = document.createElement.bind(document);
  let captured = '';
  const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = realCreate(tag);
    if (tag === 'a') {
      const anchor = el as HTMLAnchorElement;
      anchor.click = () => { captured = anchor.download; }; // intercept; don't navigate
    }
    return el;
  });
  try { action(); } finally { spy.mockRestore(); }
  return captured;
}

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
afterEach(() => cleanup());

describe('AC-B1 — no stray live "GammaFlow" on user-visible brand surfaces', () => {
  it('landing shows "Convexa" and no "GammaFlow"', () => {
    renderRoute(<Landing />, '/');
    expect(screen.getAllByText('Convexa').length).toBeGreaterThan(0);
    expect(screen.queryByText('GammaFlow')).toBeNull();
    expect(screen.queryByText(/GammaFlow/)).toBeNull();
  });

  it('AppShell nav wordmark shows "Convexa", never "GammaFlow"', () => {
    renderRoute(<AppShell />, '/ticker/TSLA');
    expect(within(screen.getByTestId('shell-brand')).getByText('Convexa')).toBeInTheDocument();
    expect(screen.queryByText('GammaFlow')).toBeNull();
  });
});

describe('AC-B2 — download filename stems begin "convexa-", never "gammaflow-"', () => {
  it('decision-history export → convexa-decision-history-*.json', () => {
    // URL.createObjectURL/revokeObjectURL are not implemented in jsdom — stub them.
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const name = captureDownload(() => exportLog());
    expect(name.startsWith('convexa-decision-history-')).toBe(true);
    expect(name.startsWith('gammaflow-')).toBe(false);
    expect(name.endsWith('.json')).toBe(true);
  });

  it('latency-trend export → convexa-latency-trend-*.json', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const { result } = renderHook(() => useLatencyTrend());
    const name = captureDownload(() => act(() => result.current.exportNow()));
    expect(name.startsWith('convexa-latency-trend-')).toBe(true);
    expect(name.startsWith('gammaflow-')).toBe(false);
    expect(name.endsWith('.json')).toBe(true);
  });
});

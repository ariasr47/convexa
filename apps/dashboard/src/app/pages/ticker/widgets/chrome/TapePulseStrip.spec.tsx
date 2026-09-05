import { themeForPref } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publishLiveTape, resetLiveTape } from '../../liveTapeStore';
import { TapePulseStrip } from './TapePulseStrip';

describe('TapePulseStrip responsive header', () => {
  beforeEach(() => {
    resetLiveTape();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      new Proxy({}, { get: () => vi.fn() }) as unknown as CanvasRenderingContext2D,
    );
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    cleanup();
    act(() => resetLiveTape());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders offline tape and structure as separate wrapping header fields; carries NO second page-scope liveness claim', () => {
    publishLiveTape({ ticker: 'SPCX', live: null, streamOffline: true });
    render(
      <ThemeProvider theme={themeForPref('dark')}>
        <TapePulseStrip structureMid={146.15} />
      </ThemeProvider>,
    );
    const header = screen.getByTestId('tape-pulse-header');
    expect(getComputedStyle(header).display).toBe('flex');
    expect(getComputedStyle(header).flexWrap).toBe('wrap');
    expect(screen.getByTestId('tape-mid-readout')).toHaveTextContent('Mid $146.15');
    expect(screen.getByTestId('tape-structure-readout')).toHaveTextContent('Structure $146.15');
    // Re-pointed (curvature-v2-foundations, AC-57): `tape-stream-state` was a SECOND page-scope
    // liveness authority beside the header connection chip (canon rule 18). It is now DELETED —
    // the ONE connection chip (`TickerHeader`/`CommandDeck`) is the sole authority; that assertion
    // lives in `ticker.risk.spec.tsx` / the new `connection` specs, not here.
    expect(screen.queryByTestId('tape-stream-state')).toBeNull();
  });
});

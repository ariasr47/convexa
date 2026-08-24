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

  it('renders offline tape, status, and structure as separate wrapping header fields', () => {
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
    expect(screen.getByTestId('tape-stream-state')).toHaveTextContent('⏸ Stream offline');
    expect(screen.getByTestId('tape-structure-readout')).toHaveTextContent('Structure $146.15');
  });
});

/**
 * Chip navigation glue (AC-3). Visit recording is the route-effect's job (see F4 binding choice).
 */
import { describe, expect, it, vi } from 'vitest';
import { selectTickerSymbol } from './selectTickerSymbol';

describe('selectTickerSymbol', () => {
  it('uppercases, syncs input, navigates to /ticker/SYMBOL', () => {
    const navigate = vi.fn();
    const setSymbol = vi.fn();
    selectTickerSymbol({ symbol: 'iwm', navigate, setSymbol });
    expect(setSymbol).toHaveBeenCalledWith('IWM');
    expect(navigate).toHaveBeenCalledWith('/ticker/IWM');
  });

  it('no-ops on blank', () => {
    const navigate = vi.fn();
    const setSymbol = vi.fn();
    selectTickerSymbol({ symbol: '  ', navigate, setSymbol });
    expect(navigate).not.toHaveBeenCalled();
    expect(setSymbol).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from 'vitest';
import {
  TRIO,
  digestRetryGets,
  pageRetryGets,
  presentClickGets,
  unlockGets,
  chipTapGets,
} from './schedule';

describe('schedule fan-out', () => {
  it('TRIO is SPY QQQ IWM', () => {
    expect(TRIO).toEqual(['SPY', 'QQQ', 'IWM']);
  });

  it('pageRetryGets = list(selected)+coverage, never load', () => {
    expect(pageRetryGets('QQQ')).toEqual([
      { kind: 'list', symbol: 'QQQ' },
      { kind: 'coverage' },
    ]);
    expect(pageRetryGets('SPY').some((g) => g.kind === 'load')).toBe(false);
  });

  it('digestRetryGets = that identity load only', () => {
    expect(digestRetryGets({ symbol: 'SPY', et_date: '2024-01-02' })).toEqual([
      { kind: 'load', symbol: 'SPY', et_date: '2024-01-02' },
    ]);
  });

  it('unlockGets = list+coverage', () => {
    expect(unlockGets('SPY')).toEqual([
      { kind: 'list', symbol: 'SPY' },
      { kind: 'coverage' },
    ]);
  });

  it('chip tap = list only', () => {
    expect(chipTapGets('IWM')).toEqual([{ kind: 'list', symbol: 'IWM' }]);
  });

  it('present other-symbol = list+load; same-symbol = load only', () => {
    expect(presentClickGets('SPY', { symbol: 'QQQ', et_date: '2024-06-03' })).toEqual([
      { kind: 'list', symbol: 'QQQ' },
      { kind: 'load', symbol: 'QQQ', et_date: '2024-06-03' },
    ]);
    expect(presentClickGets('SPY', { symbol: 'SPY', et_date: '2024-06-03' })).toEqual([
      { kind: 'load', symbol: 'SPY', et_date: '2024-06-03' },
    ]);
  });
});

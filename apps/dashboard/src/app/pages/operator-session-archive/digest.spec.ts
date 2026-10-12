import { describe, expect, it } from 'vitest';
import { projectDigest } from './digest';

describe('projectDigest', () => {
  it('returns counts only and omits raw arrays from the projection', () => {
    const body = {
      symbol: 'SPY',
      et_date: '2024-06-03',
      source_as_of: '2024-06-03T20:00:00Z',
      source: 'live_massive',
      authorizes: 'nothing',
      framing: 'RESEARCH READ — SESSION BOOK',
      provenance: 'loaded from session archive · no vendor call',
      license: 'Our research · not redistributed on a trader route.',
      market: {
        ticker: 'SPY',
        synchronized_spot: 1,
        current_spot: 1,
        timestamp: 1,
        atm_iv: 0.1,
        atm_iv_expiration: null,
        atm_iv_dte: null,
        market_phase: 'rth',
        contracts: [{ id: 1 }, { id: 2 }, { id: 3 }],
      },
      daily_bars: [{ o: 1 }, { o: 2 }],
      minutes: [{ t: 1 }],
      trades: [{ p: 1 }, { p: 2 }, { p: 3 }, { p: 4 }],
    };

    const dig = projectDigest(body);
    expect(dig).toEqual({
      symbol: 'SPY',
      et_date: '2024-06-03',
      source_as_of: '2024-06-03T20:00:00Z',
      source: 'live_massive',
      authorizes: 'nothing',
      framing: 'RESEARCH READ — SESSION BOOK',
      provenance: 'loaded from session archive · no vendor call',
      license: 'Our research · not redistributed on a trader route.',
      contractsCount: 3,
      dailyBarsCount: 2,
      minutesCount: 1,
      tradesCount: 4,
    });
    expect(dig).not.toHaveProperty('market');
    expect(dig).not.toHaveProperty('daily_bars');
    expect(dig).not.toHaveProperty('minutes');
    expect(dig).not.toHaveProperty('trades');
    expect(dig).not.toHaveProperty('contracts');
  });
});

/**
 * Unit — entry/fill resolver + the resting-limit cross rule (AC-12..AC-16, AC-18, AC-20).
 */
import type { TrackedContract } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import { limitWouldFill, resolveManualFill, resolveMarketFill } from './entry';

function tracked(over: Partial<TrackedContract> = {}): TrackedContract {
  return {
    ticker: 'TSLA',
    expiration: '2026-07-17',
    strike: 250,
    right: 'call',
    option_quote: { bid: 4.9, ask: 5.1, mid: 5 },
    greeks: { delta: 0.5, gamma: 0.01, theta: -0.05, vega: 0.1 },
    iv: 0.45,
    dte: 25,
    ...over,
  };
}

describe('manual fill (AC-12, AC-13)', () => {
  it('uses the typed price with a user_entered basis', () => {
    expect(resolveManualFill(7.25)).toEqual({ mark: 7.25, basis: 'user_entered' });
  });
});

describe('market fill (AC-14, AC-15, AC-16)', () => {
  it('fills at the live option mid with a snapshot basis', () => {
    const f = resolveMarketFill(tracked(), 250, 'call', 250);
    expect(f).toEqual({ mark: 5, basis: 'snapshot' });
  });

  it('falls back to a labeled theoretical mark when there is no quote', () => {
    const f = resolveMarketFill(tracked({ option_quote: null }), 250, 'call', 250);
    expect(f?.basis).toBe('theoretical');
    expect(f?.mark).toBeGreaterThan(0);
  });

  it('cannot resolve a fill when there is no quote AND no IV', () => {
    expect(
      resolveMarketFill(tracked({ option_quote: null, iv: null }), 250, 'call', 250),
    ).toBeNull();
  });

  it('cannot resolve a fill when the contract is unavailable (null tracked)', () => {
    expect(resolveMarketFill(null, 250, 'call', 250)).toBeNull();
  });
});

describe('limit cross rule (AC-18, AC-20)', () => {
  it('fills a buy limit when the LIVE mark is at or below the limit', () => {
    expect(limitWouldFill(4.9, 5, true)).toBe(true);
    expect(limitWouldFill(5, 5, true)).toBe(true); // at the limit
  });

  it('does not fill when the mark is above the limit (wrong side)', () => {
    expect(limitWouldFill(5.5, 5, true)).toBe(false);
  });

  it('never fills off a non-live mark even if it would cross (no fabricated fills)', () => {
    expect(limitWouldFill(4.0, 5, false)).toBe(false); // offline/last-known/frozen mark
    expect(limitWouldFill(null, 5, true)).toBe(false);
  });
});

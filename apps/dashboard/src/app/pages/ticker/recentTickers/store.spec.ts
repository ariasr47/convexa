/**
 * recentTickers store — pure unit (AC-2, AC-5, AC-6).
 * Durable key: convexa.recent-tickers.v1. Pins closed. Visits keep pins; the Quick row's recents ≤8, no pins.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_RECENTS,
  RECENT_TICKERS_KEY,
  __resetRecentTickers,
  listRecentVisits,
  listRecents,
  recordVisit,
} from './store';

beforeEach(() => {
  localStorage.clear();
  __resetRecentTickers();
});
afterEach(() => {
  localStorage.clear();
  __resetRecentTickers();
});

describe('recentTickers store', () => {
  it('recordVisit uppercases, MRU-front, de-dupes self', () => {
    recordVisit('aapl');
    recordVisit('meta');
    recordVisit('aapl');
    expect(listRecents()).toEqual(['AAPL', 'META']);
  });

  it('survives reload (re-hydrate from localStorage)', () => {
    recordVisit('IWM');
    recordVisit('AMD');
    __resetRecentTickers(); // drop memory; force re-read
    expect(listRecents()).toEqual(['AMD', 'IWM']);
    expect(localStorage.getItem(RECENT_TICKERS_KEY)).toBeTruthy();
  });

  it('⌘K visits keep the pins; the Quick row leaves them out and never loses a recent to one', () => {
    for (let i = 0; i < MAX_RECENTS; i++) recordVisit(`T${i}`);
    recordVisit('nvda');
    recordVisit('SPY');
    recordVisit('QQQ');
    expect(listRecentVisits(4)).toEqual(['QQQ', 'SPY', 'NVDA', 'T7']);
    __resetRecentTickers(); // the pins survive a reload too
    expect(listRecents()).toHaveLength(MAX_RECENTS);
    expect(listRecents()).not.toContain('NVDA');
    expect(listRecents()[MAX_RECENTS - 1]).toBe('T0');
  });

  it('corrupt blob → empty recents, does not throw, leaves original key intact until write', () => {
    localStorage.setItem(RECENT_TICKERS_KEY, '{not-json');
    __resetRecentTickers();
    expect(() => listRecents()).not.toThrow();
    expect(listRecents()).toEqual([]);
    // original corrupt blob still present (absent-is-not-none / loss-free degrade)
    expect(localStorage.getItem(RECENT_TICKERS_KEY)).toBe('{not-json');
  });
});

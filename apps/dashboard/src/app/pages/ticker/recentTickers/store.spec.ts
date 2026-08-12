/**
 * recentTickers store — pure unit (AC-2, AC-5, AC-6).
 * Durable key: convexa.recent-tickers.v1. Pins closed. Recents ≤8, de-duped vs pins.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_RECENTS,
  PINNED_TICKERS,
  RECENT_TICKERS_KEY,
  __resetRecentTickers,
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
  it('pins are closed SPY · QQQ · NVDA in fixed order', () => {
    expect(PINNED_TICKERS).toEqual(['SPY', 'QQQ', 'NVDA']);
  });

  it('empty storage → listRecents() is [] (pins still exist separately)', () => {
    expect(listRecents()).toEqual([]);
  });

  it('recordVisit uppercases, MRU-front, de-dupes self', () => {
    recordVisit('aapl');
    recordVisit('meta');
    recordVisit('aapl');
    expect(listRecents()).toEqual(['AAPL', 'META']);
  });

  it('recordVisit of a pin does NOT appear in recents', () => {
    recordVisit('SPY');
    recordVisit('qqq');
    recordVisit('IWM');
    expect(listRecents()).toEqual(['IWM']);
  });

  it('caps recents at MAX_RECENTS (8) beyond pins', () => {
    expect(MAX_RECENTS).toBe(8);
    const syms = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9'];
    for (const s of syms) recordVisit(s);
    const r = listRecents();
    expect(r).toHaveLength(8);
    expect(r[0]).toBe('A9'); // most recent first
    expect(r).not.toContain('A1'); // oldest dropped
  });

  it('survives reload (re-hydrate from localStorage)', () => {
    recordVisit('IWM');
    recordVisit('AMD');
    __resetRecentTickers(); // drop memory; force re-read
    expect(listRecents()).toEqual(['AMD', 'IWM']);
    expect(localStorage.getItem(RECENT_TICKERS_KEY)).toBeTruthy();
  });

  it('corrupt blob → empty recents, does not throw, leaves original key intact until write', () => {
    localStorage.setItem(RECENT_TICKERS_KEY, '{not-json');
    __resetRecentTickers();
    expect(() => listRecents()).not.toThrow();
    expect(listRecents()).toEqual([]);
    // original corrupt blob still present (absent-is-not-none / loss-free degrade)
    expect(localStorage.getItem(RECENT_TICKERS_KEY)).toBe('{not-json');
  });

  it('ignores blank / whitespace visits', () => {
    recordVisit('  ');
    recordVisit('');
    expect(listRecents()).toEqual([]);
  });
});

// Filings reads in chunks of 30 (the route's limit). A chunk that failed must leave its tickers out
// of `asked`, so their rules read unavailable rather than quiet (W1-46).
import type { PublicFilings } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import { checkFiling } from './publicRules';
import type { AlertRule } from './types';
import { mergeFilings } from './usePublicChecks';

const answer = (tickers: string[]): PublicFilings => ({
  state: 'live',
  detail: null,
  checked_at: '2026-10-09T12:00:00Z',
  missing: [],
  results: [],
  sources: [
    {
      id: 'sec',
      name: 'SEC EDGAR',
      state: 'updated',
      as_of: null,
      checked_at: null,
      detail: null,
      failed_at: null,
    },
  ],
  filings: tickers.map((ticker, i) => ({
    ticker,
    cik: '1',
    accession: `acc-${ticker}-${i}`,
    form: '8-K',
    items: [],
    filed: '2026-10-09',
    report_date: null,
    description: null,
    url: 'https://www.sec.gov/x',
    kind: 'other',
  })),
});

const rule = (symbol: string): AlertRule => ({
  id: `r-${symbol}`,
  kind: 'filing',
  symbol,
  enabled: true,
  createdAt: Date.parse('2026-10-01T12:00:00'),
  forms: ['8-K'],
});

describe('mergeFilings', () => {
  const first = Array.from({ length: 30 }, (_, i) => `T${String.fromCharCode(65 + (i % 26))}${i}`);
  it('every chunk answered: every ticker was asked, and the 31st still fires', () => {
    const { filings, asked } = mergeFilings([first, ['ZZ']], [answer([first[0]]), answer(['ZZ'])]);
    expect(asked.size).toBe(31);
    expect(checkFiling(rule('ZZ'), filings, asked).outcome).toBe('fired');
  });
  it('a failed chunk: its tickers are unavailable, the other chunk’s still check', () => {
    const { filings, asked } = mergeFilings([first, ['ZZ']], [answer([first[0]]), null]);
    expect(checkFiling(rule('ZZ'), filings, asked).outcome).toBe('unavailable');
    expect(checkFiling(rule(first[0]), filings, asked).outcome).toBe('fired');
  });
  it('no chunk answered: the read failed', () => {
    expect(mergeFilings([['NVDA']], [null]).filings).toBeNull();
  });
});

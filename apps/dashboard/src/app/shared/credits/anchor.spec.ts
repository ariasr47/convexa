import { describe, expect, it } from 'vitest';
import { SOURCES } from '../../pages/trust/sources';
import { creditsAnchor } from './anchor';

// A chip that links to a card that isn't there fails silently (the page opens at the top), and a
// chip that names the wrong card misattributes the data. Pinned against the chips the site draws.
describe('creditsAnchor', () => {
  it.each([
    ['U.S. Treasury · through Oct 9, 2026', 'treasury'],
    ['Demo · shaped like U.S. Treasury data', 'treasury'],
    ['CFTC Traders in Financial Futures · as of Oct 6', 'cftc'],
    ['FINRA · consolidated short interest', 'finra-si'],
    ['FINRA · Reg SHO daily short-sale volume', 'finra-shvol'],
    ['SEC Form 4 · 6 filings, latest Oct 2', 'sec'],
    ['SEC EDGAR · checked Oct 13, 07:00 UTC', 'sec'],
    ['Fed H.4.1 · Treasury DTS · NY Fed reverse repo', 'fed-h41'],
    ['Fed · BLS · BEA · Treasury schedules · SEC EDGAR', 'schedules'],
    ['Chart by TradingView · US prices delayed', 'tradingview'],
    ['Demo · sample data', null],
    ['Convexa research notes · forecasts', null],
  ] as const)('%s → %s', (text, anchor) => {
    expect(creditsAnchor(text)).toBe(anchor);
  });

  it('only names cards the credits page has', () => {
    const ids = new Set(SOURCES.map((s) => s.id));
    for (const text of [
      'U.S. Treasury',
      'CFTC',
      'Fed H.4.1',
      'Treasury DTS',
      'NY Fed reverse repo',
      'BLS schedules',
      'FINRA short interest',
      'Reg SHO',
      'SEC EDGAR',
      'TradingView',
      'Massive',
    ]) {
      const anchor = creditsAnchor(text);
      expect(anchor && ids.has(anchor)).toBe(true);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { tradingViewSymbol } from './tradingView';

// A wrong exchange prefix fails silently: TradingView shows "symbol not available" (or another
// listing) inside an iframe Convexa can't read. One table for the contract.
describe('tradingViewSymbol', () => {
  it.each([
    ['NVDA', 'Nasdaq · AI accelerators', 'NASDAQ:NVDA'],
    ['tsm', 'NYSE ADR · Contract chipmaker', 'NYSE:TSM'],
    ['XYZ', 'NYSE Arca · an ETF', 'AMEX:XYZ'],
    ['SPY', null, 'AMEX:SPY'],
    ['QQQ', undefined, 'NASDAQ:QQQ'],
    ['AAPL', null, 'AAPL'],
    ['BRK.B', 'NYSE · Conglomerate', 'NYSE:BRK.B'],
  ])('%s with %s → %s', (ticker, about, expected) => {
    expect(tradingViewSymbol(ticker, about)).toBe(expected);
  });
});

/**
 * TradingView's free embedded widgets: the live site's price chart and technical summary. TradingView
 * licenses the prices itself, so Convexa shows its widgets as they are and never reads, stores or
 * computes from the data inside them (TradingView policies §3, display only; §4, the attribution line
 * stays as designed). US prices in the widgets are delayed. Decision and terms:
 * docs/public-data/CANDIDATES.md ("Research, 2026-10-13").
 *
 * The Content-Security-Policy allows exactly these origins (apps/dashboard/public/_headers):
 * script-src LOADER_ORIGIN; frame-src the two widget hosts the loader frames.
 */
export const LOADER_ORIGIN = 'https://s3.tradingview.com';

/** NYSE Arca ETFs. TradingView files every Arca listing under the exchange code "AMEX". */
const ARCA = new Set([
  'SPY',
  'IWM',
  'DIA',
  'GLD',
  'SLV',
  'TLT',
  'HYG',
  'LQD',
  'EEM',
  'EFA',
  'XLB',
  'XLC',
  'XLE',
  'XLF',
  'XLI',
  'XLK',
  'XLP',
  'XLRE',
  'XLU',
  'XLV',
  'XLY',
  'XBI',
  'XRT',
  'XHB',
  'KRE',
  'ARKK',
  'USO',
  'UNG',
  'VXX',
  'UVXY',
  'SVXY',
  'SQQQ',
  'SPXL',
  'SPXS',
  'SDS',
  'SSO',
  'SH',
]);
/** Nasdaq-listed ETFs. */
const NASDAQ_ETF = new Set(['QQQ', 'TQQQ', 'SMH', 'SOXX', 'IBB', 'QQQM']);

/**
 * TradingView's exchange-prefixed symbol for a ticker. `about` is a research note's `about` line,
 * whose first segment names the listing ("Nasdaq · …", "NYSE ADR · …"). With no exchange known, the
 * bare ticker goes through and TradingView resolves its primary listing.
 */
export function tradingViewSymbol(ticker: string, about?: string | null): string {
  // Share classes keep their dot: TradingView lists Berkshire's B shares as NYSE:BRK.B.
  const t = ticker.trim().toUpperCase();
  if (!/^[A-Z0-9.]{1,10}$/.test(t)) return t;
  if (ARCA.has(t)) return `AMEX:${t}`;
  if (NASDAQ_ETF.has(t)) return `NASDAQ:${t}`;
  const listing = (about ?? '').split('·')[0]?.trim().toUpperCase() ?? '';
  if (/^NASDAQ\b/.test(listing)) return `NASDAQ:${t}`;
  if (/^NYSE ARCA\b/.test(listing)) return `AMEX:${t}`;
  if (/^NYSE\b/.test(listing)) return `NYSE:${t}`;
  return t;
}

/** TradingView's symbol page, for the attribution link (`NASDAQ:NVDA` → `NASDAQ-NVDA`). */
export function tradingViewSymbolPath(symbol: string): string {
  return encodeURIComponent(symbol.replace(':', '-'));
}

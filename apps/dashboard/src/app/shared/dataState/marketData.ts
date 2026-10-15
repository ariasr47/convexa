/**
 * What the site says about market data (canon P-1, 2026-10-13). `not_live`: the server runs with no
 * vendor key, so no paid options feed exists to resume; the honest word is "not live", never
 * "paused". `paused`: a feed exists and an operator stopped it. Both mean no market data arrives, so
 * features that wait on it are off either way.
 */
import type { MarketDataMode } from '@convexa/api';

export const marketDataOff = (mode: MarketDataMode | null): boolean =>
  mode === 'paused' || mode === 'not_live';

export const NOT_LIVE_COPY = {
  title: 'Options data isn’t live on this site.',
  // SEC EDGAR is left out on purpose: production says “Not set up” for filings until the operator
  // sets SEC_USER_AGENT, and the bar makes no request that could tell it apart (/methodology#data
  // says so row by row).
  body: 'Dealer structure, flow and AI reads need a paid options feed. Rates, positioning, short data, research and TradingView’s daily charts are live.',
  short: 'Options data isn’t live on this site',
};

/** /api/health failed or answered nothing we recognise: the bar claims nothing either way. */
export const UNKNOWN_COPY = {
  title: 'Couldn’t check what’s live right now.',
  body: 'Each panel still says where its numbers came from.',
};

export const PAUSED_COPY = {
  title: 'Live market data is off.',
  body: 'Prices, dealer structure and AI reads are paused. Daily charts come from TradingView, and research notes are current.',
};

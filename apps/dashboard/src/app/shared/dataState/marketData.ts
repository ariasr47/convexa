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
  // What is live on production, as /methodology#data lists it row by row: SEC filings are live
  // (SEC_USER_AGENT is set, 2026-10-15); FINRA's short data is left out because the owner keeps it
  // Off until its terms are confirmed (shared/dataState/finraSwitch.ts).
  body: 'Dealer structure, flow and AI reads need a paid options feed. Rates, positioning, filings, research and TradingView’s daily charts are live.',
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

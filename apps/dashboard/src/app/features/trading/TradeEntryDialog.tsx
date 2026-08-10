/**
 * TradeEntryDialog — public entry (stable import path for Ticker / Positions / tests).
 * Implementation lives under ./tradeEntry/* (Phase D split).
 */
export type {
  EntryPrefill,
  FillMode,
  LegDraft,
  MarketFillBasis,
  OrderEntrySubmit,
  OrderPlan,
  TradeEntrySubmit,
} from './tradeEntry';
export { defaultGoodTil, goodTilToExpiresAt, newDraft, TradeEntryDialog } from './tradeEntry';
export { TradeEntryDialog as default } from './tradeEntry';

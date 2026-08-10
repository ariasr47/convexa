/**
 * TradeEntryDialog — public entry (stable import path for Ticker / Positions / tests).
 * Implementation lives under ./tradeEntry/* (Phase D split).
 */
export {
  TradeEntryDialog,
  TradeEntryDialog as default,
  defaultGoodTil,
  goodTilToExpiresAt,
  newDraft,
} from './tradeEntry';
export type {
  EntryPrefill,
  FillMode,
  LegDraft,
  MarketFillBasis,
  OrderEntrySubmit,
  OrderPlan,
  TradeEntrySubmit,
} from './tradeEntry';

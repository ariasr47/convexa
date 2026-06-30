/**
 * Positions-portfolio durable types — the evolution of the single-trade ghost-trade record into a
 * flat collection of many concurrent sim positions, plus the durable customization/saved-view state.
 *
 * Everything here is CLIENT-LOCAL + durable (survives reload + SSE drop). No real order is ever
 * placed (`[no-real-order-path]`). Positions/customization/saved views are NEVER an input to the
 * backend signals/score/tier/fingerprint (`[additive-keeps-score-byte-identical]`).
 *
 * Schema is versioned; v1 (single trade per ticker) migrates loss-free into v2 (flat positions map).
 */
import type { OptionRight } from '@org/api';
import type { GhostTrade, DecisionRecord } from '../ghost-trade/types';
import type { MarkBasis } from '../ghost-trade/types';

export type { MarkBasis } from '../ghost-trade/types';
export type { DecisionRecord } from '../ghost-trade/types';

export const PORTFOLIO_SCHEMA_VERSION = 2;

/** How a position was OPENED (entry provenance / fill mode). UX_BLUEPRINT §2.1. */
export type EntryMode = 'manual' | 'market' | 'limit';

/** Lifecycle status. UX_BLUEPRINT §2.2. `pending` = a resting limit; `cancelled`/`closed` terminal. */
export type PositionStatus = 'open' | 'pending' | 'closed' | 'cancelled';

/**
 * The entry-basis label (BESIDE the running `MarkBasis`). A manual entry is `user_entered`; a market
 * entry reuses `snapshot`/`theoretical`; a limit fill is `limit_fill`. UX_BLUEPRINT §3.
 */
export type EntryBasis = MarkBasis | 'user_entered' | 'limit_fill';

export type PositionId = string;

/**
 * One position — the evolution of `GhostTrade`. Every new field is additive/optional so a v1
 * `GhostTrade` reads as a valid `Position` after the re-key migration (a v1 record has no
 * `entry_mode`/`limit_price` ⇒ it reads as a `manual` open position, which is exactly what it was).
 */
export interface Position {
  id: PositionId;
  ticker: string;
  expiration: string; // YYYY-MM-DD
  strike: number;
  right: OptionRight;
  side: 'long';
  qty: number;
  entry_mark: number; // the fill basis price
  entry_basis: EntryBasis;
  entry_time: string; // ISO-8601 (for limit: set at FILL time)
  stop?: number | null;
  target?: number | null;
  status: PositionStatus;
  // NEW — entry provenance. Absent (v1 migration) ⇒ treated as `manual`.
  entry_mode?: EntryMode;
  // NEW — resting-limit fields (present only for a limit order).
  limit_price?: number | null;
  placed_time?: string; // when the limit was placed (status went pending)
  // Realized facts on close/cancel.
  realized_pl_dollar?: number;
  realized_pl_pct?: number;
  close_time?: string;
  schema_version: number;
}

/** Derived strategy axis (Q-C). Single-leg long only ⇒ trivially derived from `right`. */
export type Strategy = 'long_call' | 'long_put';
export function strategyOf(p: Pick<Position, 'right'>): Strategy {
  return p.right === 'call' ? 'long_call' : 'long_put';
}

// ---- Customization / saved-view state (durable, view-only — never feeds scoring) ---------------

export type LayoutMode = 'table' | 'card';
export type Density = 'comfortable' | 'compact';
export type GroupAxis = 'none' | 'ticker' | 'strategy' | 'expiry';
export type SortDir = 'asc' | 'desc';

/** Sortable attribute keys (UX_BLUEPRINT §5.3). */
export type SortKey =
  | 'pl_dollar' | 'pl_pct' | 'delta_entry' | 'session_delta'
  | 'ticker' | 'strategy' | 'expiry' | 'dte' | 'qty' | 'entry_time';

/** All selectable column keys (UX_BLUEPRINT §5.1). Order in `columns` is the display order. */
export type ColumnKey =
  | 'simulated' | 'contract' | 'status' | 'mode' | 'mark' | 'pl' | 'pl_pct'
  | 'delta_entry' | 'session_delta' | 'trend' | 'entry' | 'qty'
  | 'expiry' | 'strike' | 'right' | 'strategy' | 'dte' | 'greeks' | 'iv'
  | 'stop' | 'target' | 'entry_time' | 'opened';

export interface FilterState {
  ticker: string | null;           // null = all tickers
  status: PositionStatus[];        // multi-select; default = ['open']
  strategy: Strategy | null;       // null = all
  expiry: string | null;           // null = all
}

/** The serializable view configuration captured by a saved view. */
export interface ViewConfig {
  columns: ColumnKey[];   // selection + order
  sortKey: SortKey;
  sortDir: SortDir;
  group: GroupAxis;
  layout: LayoutMode;
  density: Density;
  filter: FilterState;
}

export interface SavedView {
  id: string;
  name: string;
  builtin?: boolean; // the seeded "All positions" default; cannot be deleted
  config: ViewConfig;
}

export interface CustomizationState {
  views: SavedView[];
  activeViewId: string;
  /** The live working config (may diverge from the active saved view → the unsaved-changes dot). */
  working: ViewConfig;
}

// ---- Persist shape (v2) ------------------------------------------------------------------------

export interface PersistShapeV2 {
  schema_version: number;
  positions: Record<PositionId, Position>;
  decisions: DecisionRecord[];
  customization: CustomizationState;
}

/** v1 shape (the shipped ghost-trade store) — read-only, for migration. */
export interface PersistShapeV1 {
  schema_version: number;
  trades: Record<string, GhostTrade>;
  decisions: DecisionRecord[];
}

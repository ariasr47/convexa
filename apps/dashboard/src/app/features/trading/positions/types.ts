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
import type { DecisionRecord, GhostTrade, MarkBasis } from '@/features/trading/model/types';
import type { OptionRight } from '@org/api';
import type { StructureKind } from './structure';

export type { DecisionRecord, MarkBasis } from '@/features/trading/model/types';

export const PORTFOLIO_SCHEMA_VERSION = 2;

/** How a position was OPENED (entry provenance / fill mode). UX_BLUEPRINT §2.1. */
export type EntryMode = 'manual' | 'market' | 'limit';

/** Lifecycle status. UX_BLUEPRINT §2.2. `pending` = a resting limit; `cancelled`/`closed` terminal. */
export type PositionStatus = 'open' | 'pending' | 'closed' | 'cancelled';

/**
 * The entry-basis label (BESIDE the running `MarkBasis`). A manual entry is `user_entered`; a market
 * entry reuses `snapshot`/`theoretical`; a limit fill is `limit_fill`. UX_BLUEPRINT §3.
 * ai-rec-backtest-orders adds `trigger_fill`: a sim-order market-on-trigger fill at the first
 * live-resolvable option mark after the trigger crossed (additive literal, arch §2).
 */
export type EntryBasis = MarkBasis | 'user_entered' | 'limit_fill' | 'trigger_fill';

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
  // ai-rec-backtest-orders (additive optional, NO version bump — the `entry_mode` discipline):
  // the SimOrder whose fill created this position (the position→order backlink, AC-31). Full
  // provenance stays on the order, single-sourced, reachable via this join.
  origin_order_id?: string;
}

// The old two-member `Strategy` axis (`long_call` | `long_put`) and its `strategyOf` derivation are
// DELETED. The axis is now `StructureKind` (`./structure`) — derived, total, never stored — which is
// what makes future recogniser changes migration-free. Nothing carries a stored strategy forward.

// ---- Customization / saved-view state (durable, view-only — never feeds scoring) ---------------

export type LayoutMode = 'table' | 'card';
export type Density = 'comfortable' | 'compact';
/** `expiry` does NOT return (ruling #10). The axis stays reachable in `derive.ts`, so restoring it
 *  later costs zero schema — only this union and the toolbar option would change. */
export type GroupAxis = 'none' | 'ticker' | 'structure';
export type SortDir = 'asc' | 'desc';

/** Sortable attribute keys (UX_BLUEPRINT §5.3). */
export type SortKey =
  | 'pl_dollar'
  | 'pl_pct'
  | 'delta_entry'
  | 'session_delta'
  | 'ticker'
  | 'structure'
  | 'expiry'
  | 'dte'
  | 'qty'
  | 'entry_time';

/** All selectable column keys (UX_BLUEPRINT §5.1). Order in `columns` is the display order. */
export type ColumnKey =
  | 'simulated'
  | 'contract'
  | 'status'
  | 'mode'
  | 'mark'
  | 'pl'
  | 'pl_pct'
  | 'delta_entry'
  | 'session_delta'
  | 'trend'
  | 'entry'
  | 'max_loss'
  | 'qty'
  | 'expiry'
  | 'strike'
  | 'right'
  | 'structure'
  | 'dte'
  | 'greeks'
  | 'iv'
  | 'stop'
  | 'target'
  | 'entry_time'
  | 'opened';

export interface FilterState {
  ticker: string | null; // null = all tickers
  status: PositionStatus[]; // multi-select; default = ['open']
  structure: StructureKind | null; // null = all (was the two-member `strategy` axis)
  expiry: string | null; // null = all
}

/** The serializable view configuration captured by a saved view. */
export interface ViewConfig {
  columns: ColumnKey[]; // selection + order
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

// ---- Store health (SPEC §2.9) -------------------------------------------------------------------

/**
 * The durable store's fault state, returned by the portfolio hook on the SAME object the view layer
 * already reads — so the state cannot be dropped by a caller forgetting to inspect a return value.
 *
 * Fault determination is SYNCHRONOUS at store initialisation (`localStorage` is synchronous, so this
 * is free), which is what guarantees no frame ever paints enabled affordances on a faulted store.
 * Declared here, once, so F16 and F18 share ONE definition.
 */
export interface StoreHealth {
  /** True iff any source blob, or the v3 blob itself, failed to parse. */
  faulted: boolean;
  /** The storage keys that failed. Populated at the cutover; `[]` while the store is still v2. */
  unread_sources: string[];
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

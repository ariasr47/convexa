/**
 * Ghost-trade (paper/simulation) durable types. The trade record + decision history are
 * CLIENT-LOCAL and durable (survive reload + SSE drop). No real order is ever placed.
 */
import type { OptionRight } from '@org/api';

export const SCHEMA_VERSION = 1;

/** How the current mark was derived — the honesty mechanism (never show a frozen value as live).
 *  `manual` = a user-typed entry price (manual/limit fill mode in the entry dialog) — not a market quote. */
export type MarkBasis = 'snapshot' | 'modeled' | 'theoretical' | 'last_known' | 'manual';

export interface GhostTrade {
  id: string;
  ticker: string;
  expiration: string; // YYYY-MM-DD
  strike: number;
  right: OptionRight;
  side: 'long';       // long single-leg only (v1)
  qty: number;
  entry_mark: number; // option mid (or theoretical) at entry — the fill basis
  entry_basis: MarkBasis;
  entry_time: string; // ISO-8601
  // Optional risk plan seeded from an AI rec's exit_plan (UX_BLUEPRINT §5) and editable at entry.
  // Additive + optional: older records simply lack them; not used by the mark/P-L math (v1).
  stop?: number | null;
  target?: number | null;
  status: 'open' | 'closed';
  realized_pl_dollar?: number;
  realized_pl_pct?: number;
  close_time?: string;
  schema_version: number;
}

export type DecisionEvent =
  | 'open' | 'close' | 'accept' | 'reject' | 'alert' | 'roll'
  // Positions-portfolio additions (UX_BLUEPRINT §2.3) — the resting-limit lifecycle events.
  | 'limit_placed' | 'limit_filled' | 'limit_cancelled'
  // ai-rec-backtest-orders additions (arch §2 audit spine): the sim-order lifecycle events,
  // appended to the SAME append-only log with `trade_id` = the ORDER id. The fill ALSO emits the
  // existing position `open` event (trade_id = position id) so both histories are complete (AC-32).
  | 'order_placed' | 'order_triggered' | 'order_filled' | 'order_cancelled' | 'order_expired';

/** Append-only, versioned, exportable (for a future back-test of AI-assisted edge). */
export interface DecisionRecord {
  event_type: DecisionEvent;
  clock_time: string; // ISO "now"
  trade_id: string;
  contract: { ticker: string; expiration: string; strike: number; right: OptionRight; qty: number };
  mark_price: number;
  mark_basis: MarkBasis;
  underlying_spot: number;
  pl_dollar: number;
  pl_pct: number;
  ai_verdict?: string;
  verdict_id?: string;
  user_choice?: 'accept' | 'reject';
  tier: string;
  position_fingerprint: string;
  schema_version: number;
  // ai-rec-backtest-orders (additive, optional): on an `order_filled` record, the id of the
  // Position the fill created — the order→position join in the exported audit chain (AC-31/33).
  position_id?: string;
}

/** Edge-detected reassessment alert (FE-owned; fires once per distinct event). */
export interface TradeAlert {
  id: string;      // stable per event instance (for the armed/fired edge + de-dupe)
  message: string; // "{event} — consider reassessing."
  time: string;    // ISO
}

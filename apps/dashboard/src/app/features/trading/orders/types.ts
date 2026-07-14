/**
 * Sim-order durable types (ai-rec-backtest-orders, arch §2 field literals — binding).
 *
 * Everything here is CLIENT-LOCAL sim bookkeeping (`[no-real-order-path]`): a SimOrder encodes a
 * rec's plan (conditional underlying trigger, limit-or-market entry, stop/target as plan data, a
 * mandatory good-til bound) and is evaluated by the pure engine against LIVE SSE data only. Orders
 * are NEVER an input to signals/score/tier/fingerprint (`[additive-keeps-score-byte-identical]`)
 * and never ride the wire (no order endpoints exist).
 */
import type { OptionRight } from '@org/api';

export const ORDERS_SCHEMA_VERSION = 1;

/** The v1 trigger grammar — deliberately SMALL (arch §3, a binding ceiling): ONE condition, ONE
 *  comparator, ONE numeric level, evaluated against the live UNDERLYING NBBO mid ONLY. */
export type TriggerKind = 'underlying_above' | 'underlying_below';
export interface Trigger {
  kind: TriggerKind;
  level: number;
}

/** Lifecycle status (5 durable states; `filled`/`cancelled`/`expired` terminal, never re-transition). */
export type OrderStatus = 'waiting' | 'triggered' | 'filled' | 'cancelled' | 'expired';

export const TERMINAL_STATUSES: readonly OrderStatus[] = ['filled', 'cancelled', 'expired'];
export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Where the order came from. A scenario-sourced rec MUST mark `ai_scenario` + `scenario_id`
 *  (keyed off the rec's `scenario` field — the ONLY marker, INTERFACE §1.3) so scripted output is
 *  never mistakable for a real AI read (D8-4). `manual` is reserved (v1 orders are born only from
 *  the Act-on-rec flow, but the provenance shape already allows manual creation later). */
export type OrderSource = 'ai_rec' | 'ai_scenario' | 'manual';

export interface OrderProvenance {
  source: OrderSource;
  /** The rec's `pinned_fingerprint`. */
  rec_fingerprint?: string;
  /** The rec's `as_of` snapshot identity. */
  rec_as_of?: string | null;
  persona?: { id: string | null; name: string };
  scenario_id?: string;
  /** Display companion to `scenario_id` (additive beyond the arch-listed literals — the UX rows/
   *  detail render "Scripted · {name}" after reload, and the id→name catalog is not enumerable
   *  while the flag is off, so the name must persist with the order). Flagged in the lane report. */
  scenario_name?: string;
  /** The rec's verbatim free-text `entry_trigger` — ALWAYS displayed beside the structured trigger
   *  (product constraint §7); the engine never acts on this text. */
  trigger_source_text?: string | null;
}

/** How a fill priced (recorded at fill time, never backfilled). `limit_fill` = the limit price on
 *  a live cross; `trigger_fill` = the first live-resolvable option mark (market-on-trigger). */
export type OrderFillBasis = 'limit_fill' | 'trigger_fill';

/** The durable sim order (arch §2). All lifecycle facts are additive/optional. */
export interface SimOrder {
  // Identity / clock
  id: string;
  created_time: string; // ISO-8601
  schema_version: number;
  // Contract plan
  ticker: string;
  expiration: string; // YYYY-MM-DD
  strike: number;
  right: OptionRight;
  side: 'long';
  qty: number; // int >= 1
  // Entry plan
  trigger: Trigger | null; // null => armed immediately (created directly as `triggered`)
  limit_price: number | null; // null => market-on-trigger
  stop: number | null; // plan data, never evaluated by this engine
  target: number | null; // plan data, never evaluated by this engine
  expires_at: string; // REQUIRED good-til bound (ISO) — never blank (AC-8)
  // Provenance (the rec→order link)
  provenance: OrderProvenance;
  // Lifecycle
  status: OrderStatus;
  triggered_time?: string;
  filled_time?: string;
  fill_mark?: number;
  fill_basis?: OrderFillBasis;
  position_id?: string; // the created Position (the order→position link)
  close_time?: string; // cancelled / expired
  close_reason?: 'cancelled' | 'expired';
}

/** The derived, NEVER-persisted evaluation-reality sub-state (D5/D8-3, UX §4.3). Computed at
 *  render from stream availability + payload liveness; never suppressible on a non-terminal row. */
export type OrderEvalState =
  | { kind: 'watching'; mid: number | null }
  /** Covered ticker but the stream dropped: live cells dim + keep the last-known mid (`⏸ offline`),
   *  the row itself persists (`[live-vs-static-isolation]`, AC-26). */
  | { kind: 'offline'; lastMid: number | null }
  | { kind: 'not_evaluated' };

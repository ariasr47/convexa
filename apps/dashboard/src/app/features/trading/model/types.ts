/**
 * Ghost-trade (paper/simulation) durable types. The trade record + decision history are
 * CLIENT-LOCAL and durable (survive reload + SSE drop). No real order is ever placed.
 */
import type { OptionRight } from '@convexa/api';

export const SCHEMA_VERSION = 1;

/** How the current mark was derived — the honesty mechanism (never show a frozen value as live).
 *  `manual` = a user-typed entry price (manual/limit fill mode in the entry dialog) — not a market quote. */
export type MarkBasis = 'snapshot' | 'modeled' | 'theoretical' | 'last_known' | 'manual';

// `GhostTrade` is DELETED. It merged into `SimPosition` (`positions/leg.ts`) at the v3 cutover, and
// the `convexa.ghost-trade.v1` blob that held them is now read ONLY as a migration/harvest source,
// through `positions/migrate.liftLegacyRecord`, which is total over arbitrary material and therefore
// needs no interface to lean on. Everything below stays in the kernel: three domains import it.

export type DecisionEvent =
  | 'open'
  | 'close'
  | 'accept'
  | 'reject'
  | 'alert'
  | 'roll'
  // Positions-portfolio additions (UX_BLUEPRINT §2.3) — the resting-limit lifecycle events.
  | 'limit_placed'
  | 'limit_filled'
  | 'limit_cancelled'
  // ai-rec-backtest-orders additions (arch §2 audit spine): the sim-order lifecycle events,
  // appended to the SAME append-only log with `trade_id` = the ORDER id. The fill ALSO emits the
  // existing position `open` event (trade_id = position id) so both histories are complete (AC-32).
  | 'order_placed'
  | 'order_triggered'
  | 'order_filled'
  | 'order_cancelled'
  | 'order_expired';

/** One setup that was firing at entry — name + conviction ONLY (`[digested-labels-not-raw-dump]`:
 *  the `rationale`/`bias`/`strategy` prose is deliberately NOT captured). */
export interface CapturedSetup {
  name: string;
  conviction: string;
}

/**
 * outcome-ledger (ARCHITECTURE_CONTRACT §3.1 / §2-Q2): the ADDITIVE, OPTIONAL entry-context digest,
 * attached best-effort at the 5 decision-point events. Every field is INDEPENDENTLY nullable.
 *
 *   - the digest object ABSENT          ⇒ the record PREDATES capture (the epoch marker)
 *   - the digest PRESENT with a null field ⇒ capture ran; that source was genuinely unavailable
 *
 * No key change, no shape break, no `SCHEMA_VERSION` bump, NO BACKFILL — ever. A pre-capture record
 * is valid forever and is never rewritten to invent context it did not observe.
 */
export interface EntryContextDigest {
  /** `signals.opportunity_score` — the scalar. Captured, never re-derived into a tier. */
  opportunity_score: number | null;
  /** `signals.setups[]`, capped at 5. */
  setups: CapturedSetup[] | null;
  /** The persona store's `active_persona_id` (null ⇒ Default / none). */
  persona_id: string | null;
  /** `market_state.iv_rank.band` — the WIRE label, never re-derived from `rank`. */
  iv_rank_band: string | null;
  /** `signals.regime`. */
  gamma_regime: string | null;
  /** `signals.vol_regime`. */
  vol_regime: string | null;
  /** `ai_eval.state_fingerprint` — the scoring-snapshot identity. */
  state_fingerprint: string | null;
  /**
   * The AI rec this entry came from, if any.
   *   - a string  ⇒ the entry carried a rec identity
   *   - `null`    ⇒ capture ran and NO rec was involved ("had none available at entry")
   *   - the KEY ABSENT ⇒ this entry came in through a path that cannot carry the rec identity at
   *     all (`not_attributable_by_path` — a plumbing gap, NOT an absence of recs). Every path this
   *     app writes today threads it, so the key is always present on records written here; the
   *     absent case exists for records imported from a browser whose capture predates the threading.
   */
  ai_rec_fingerprint?: string | null;
  /**
   * tradeable-rec-inputs (AC-82): whether a risk block was PRESENT (server `risk_inputs.state ===
   * 'set'`) at the moment this entry was captured. Independently nullable like every other digest
   * field: `true`/`false` when the resolution is known this cycle, `null` when it genuinely could
   * not be read (anonymous, or the settings read faulted) — never a fabricated `false`. This value
   * is NEVER an account-size figure and NEVER derived from one — it is the presence flag only
   * (AC-29a: no account-size value may ever reach a ledger or decision record).
   */
  risk_block_present: boolean | null;
}

/** Append-only, versioned, exportable (for a future back-test of AI-assisted edge). */
export interface DecisionRecord {
  /** outcome-ledger (additive, optional): a per-record uuid stamped at write time, so record
   *  identity (log union de-dupe + idempotent archive import) is EXACT for new records. Records
   *  written before this shipped have none and fall back to the derived composite key. */
  id?: string;
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
  // outcome-ledger (additive, optional): the entry-context digest. ABSENT ⇒ pre-capture.
  entry_context?: EntryContextDigest;
}

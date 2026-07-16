/**
 * outcome-ledger — the entry-context CAPTURE (the write side), living inside the trade model that
 * the existing recorders already depend on. The outcome LEDGER (the read) never imports this and is
 * never imported by it: capture writes, the ledger reads, and the two only meet in the durable log.
 *
 * Binding rules (ARCHITECTURE_CONTRACT §2/Q2, §4/A):
 *   - BEST-EFFORT, per field: an absent/failed source ⇒ that field is `null`. NEVER a throw.
 *   - It MUST NOT gate, block, delay or alter the trade/position/order write. Every read below is
 *     guarded; `buildEntryContextDigest` cannot throw, by construction.
 *   - It triggers NO fetch and NO recompute — it reads ONLY the bundle already in hand plus the
 *     persona store (a synchronous localStorage read the app already performs on every render).
 *   - `[digested-labels-not-raw-dump]`: a SMALL orthogonal set of labels. No raw series, no setup
 *     prose, no greeks, no ATR (it has no digested band yet), no bundle dump.
 *   - The IV-rank band is captured as the WIRE label; it is NEVER re-derived from `rank`.
 */
import type { TickerBundle } from '@org/api';
import { loadActiveId } from '@/features/personas/store';
import type { CapturedSetup, DecisionEvent, EntryContextDigest } from './types';

/** The 5 DECISION-POINT events that carry a digest (§2/Q2). `alert` is mechanical, not a decision;
 *  `order_triggered`/`order_cancelled`/`order_expired`/`close`/`limit_*` are mechanical transitions
 *  whose context is reachable through the join. `order_filled` is included because a triggered order
 *  can fill hours after placement — the entry conditions are the conditions at FILL. */
export const CAPTURE_EVENTS: readonly DecisionEvent[] = [
  'open',
  'accept',
  'reject',
  'order_placed',
  'order_filled',
];

export function capturesEntryContext(event: DecisionEvent): boolean {
  return CAPTURE_EVENTS.includes(event);
}

/** Setup capture cap (§2/Q2) — a digest, not a dump. */
export const SETUP_CAPTURE_CAP = 5;

/** Never throws: any failure in `read` ⇒ null. */
function best<T>(read: () => T | null | undefined): T | null {
  try {
    const v = read();
    return v ?? null;
  } catch {
    return null;
  }
}

export interface CaptureInput {
  /** The bundle ALREADY IN HAND on the recording surface. Absent/null ⇒ every bundle-sourced field
   *  captures as null (captured-but-unavailable), never a fetch. */
  bundle?: TickerBundle | null;
  /**
   * The rec identity this entry came from, when the surface knows one.
   *   - a fingerprint ⇒ the entry was taken from that AI rec
   *   - `null`        ⇒ no rec was involved (the honest "none available at entry")
   * Always pass one of the two: the KEY's absence is reserved to mean "this path cannot carry a rec
   * identity at all", which is a different (and, in this app, no longer occurring) fact.
   */
  aiRecFingerprint: string | null;
}

/**
 * Build the digest from what is already in hand. Total: one bundle read + one persona-store read.
 * The returned object is always well-formed (its presence is the epoch marker); individual fields
 * are null when their source was genuinely unavailable this cycle.
 */
export function buildEntryContextDigest(input: CaptureInput): EntryContextDigest {
  const bundle = input.bundle ?? null;
  const setups = best<CapturedSetup[]>(() => {
    const list = bundle?.signals?.setups;
    if (!Array.isArray(list) || list.length === 0) return null;
    return list
      .slice(0, SETUP_CAPTURE_CAP)
      .map((s) => ({ name: s.name, conviction: s.conviction }))
      .filter((s) => typeof s.name === 'string' && s.name.length > 0);
  });
  return {
    opportunity_score: best(() => bundle?.signals?.opportunity_score),
    setups: setups && setups.length > 0 ? setups : null,
    persona_id: best(() => loadActiveId()),
    // The wire label, verbatim — never re-derived from `iv_rank.rank`.
    iv_rank_band: best(() => bundle?.market_state?.iv_rank?.band),
    gamma_regime: best(() => bundle?.signals?.regime),
    vol_regime: best(() => bundle?.signals?.vol_regime),
    state_fingerprint: best(() => bundle?.ai_eval?.state_fingerprint),
    ai_rec_fingerprint: input.aiRecFingerprint,
  };
}

/** Attach the digest iff the event is a decision point. Best-effort: a failure yields NO digest
 *  field rather than a thrown write (the record itself is never lost). */
export function entryContextFor(
  event: DecisionEvent,
  input: CaptureInput,
): { entry_context: EntryContextDigest } | Record<string, never> {
  if (!capturesEntryContext(event)) return {};
  try {
    return { entry_context: buildEntryContextDigest(input) };
  } catch {
    return {};
  }
}

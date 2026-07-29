/**
 * `eval_subject` — which leg the position-context read is ABOUT (SPEC §2.8, owner ruling #9).
 *
 * v1 SUPPRESSES the evaluation for multi-leg positions. Suppression is a RENDER decision only: the
 * `pos_*` request stays unconditional and its shape never branches, so it remains byte-identical
 * and a multi-leg `pos_*` request in the network tab is CORRECT, not a defect (AC-74).
 *
 * Two fixes are kept anyway because they cost nothing and repair real bugs:
 *  - the `leg.id` FINAL TIEBREAK: without it two identical legs make the choice depend on array
 *    order, so the alert subject could change on reload with no user action;
 *  - the SHORT-LEG FALLBACK: the original long-only rule silently killed the alert for every short
 *    put, the most common short structure there is.
 *
 * There is deliberately NO `primary_leg_label` — that field is deferred with its copy, and the FE
 * lane must not build a dead field.
 *
 * Pure module: no store access, no React, no fetch.
 */
import type { Leg, LegId, SimPosition } from './leg';

/**
 * The `none` branch's reason — a CLOSED vocabulary (SPEC §2.8), snake_case, exhaustive, no free
 * text.
 *
 * TWO LEVELS, and the second member is why this is a named union rather than an inline literal:
 *  - `no_option_leg`      — POSITION-level (shares-only). Decided by `evalSubjectOf` below. Within a
 *                           position, `none` is reachable only when there is no option leg at all.
 *  - `multiple_positions` — TICKER-level (>1 open position on the focused ticker). Decided ONE LEVEL
 *                           UP, in `tickerEvalSubject`, which `evalSubjectOf` knows nothing about.
 */
export type EvalNoneReason = 'no_option_leg' | 'multiple_positions';

export type EvalSubject =
  | { kind: 'whole_position'; leg_id: LegId }
  | { kind: 'primary_leg'; leg_id: LegId; of_legs: number }
  | { kind: 'none'; reason: EvalNoneReason };

const notional = (l: Leg) => Math.abs(l.qty * l.multiplier);

/** Largest notional, then nearest expiration, then lowest strike, then leg.id lexicographic. */
function pick(candidates: readonly Leg[]): Leg {
  return [...candidates].sort((a, b) => {
    const n = notional(b) - notional(a);
    if (n !== 0) return n;
    const ea = a.expiration ?? '9999-12-31';
    const eb = b.expiration ?? '9999-12-31';
    if (ea !== eb) return ea < eb ? -1 : 1;
    const sa = a.strike ?? Number.POSITIVE_INFINITY;
    const sb = b.strike ?? Number.POSITIVE_INFINITY;
    if (sa !== sb) return sa - sb;
    return a.id.localeCompare(b.id);
  })[0];
}

export function evalSubjectOf(p: SimPosition): EvalSubject {
  const options = p.legs.filter((l) => l.kind === 'option');
  if (options.length === 0) return { kind: 'none', reason: 'no_option_leg' };

  const longs = options.filter((l) => l.side === 'long');
  const chosen = pick(longs.length > 0 ? longs : options);

  // Exactly one option leg AND no other leg at all ⇒ the position IS the leg.
  if (p.legs.length === 1) return { kind: 'whole_position', leg_id: chosen.id };
  return { kind: 'primary_leg', leg_id: chosen.id, of_legs: p.legs.length };
}

/** What the Ticker page needs to know about the focused ticker, level 1 and level 2 together. */
export interface TickerEvalSelection {
  /** The position whose leg supplies the `pos_*` params, or null when there is none to send. */
  position: SimPosition | null;
  /** The leg those params are read off. Present whenever `position` is — the request never branches. */
  queryLeg: Leg | null;
  /** What the RENDER is allowed to say. `none` carries its reason rather than an unexplained null. */
  subject: EvalSubject;
  /** The evaluation is not surfaced on ANY surface. A RENDER decision — never a fetch decision. */
  suppressed: boolean;
}

/**
 * LEVEL 1 — which position on the focused ticker speaks for it (SPEC §2.8, ruled 2026-07-28).
 *
 * | open positions on the focused ticker | behaviour                                            |
 * |--------------------------------------|------------------------------------------------------|
 * | 0                                    | as today — no position context                       |
 * | exactly 1                            | today's behaviour, BYTE-IDENTICAL; level 2 applies   |
 * | more than 1                          | SUPPRESSED, reason `multiple_positions`              |
 *
 * WHY THE REJECTED ALTERNATIVE IS REJECTED, stated here so a later reader does not re-propose it:
 * picking one of N (e.g. the most recently opened) is deterministic, but it makes the app quietly
 * assert *"this is your NVDA position"* when it is one of three. This is **owner ruling #9 applied
 * one level up** — #9 established that the app does not evaluate a subject it cannot faithfully
 * represent, and picking one of N is the same approximation the owner rejected for legs, with LESS
 * visibility. There is no regression by construction: a ticker holding 2+ positions cannot exist
 * under the shipped one-ghost-trade-per-ticker store.
 *
 * SUPPRESSION IS A RENDER DECISION ONLY. `position` is still returned when N > 1 — deterministically,
 * by lowest id — precisely so the `pos_*` request stays UNCONDITIONAL and its shape never branches,
 * on leg count or on position count (AC-74, AC-77, AC-83). A `pos_*` request appearing in the
 * network tab for a ticker holding three positions is CORRECT, not a defect. What that pick must
 * never do is reach a surface, and `suppressed` is what stops it.
 */
export function tickerEvalSubject(
  positions: readonly SimPosition[],
  ticker: string,
): TickerEvalSelection {
  const symbol = ticker.toUpperCase();
  const open = positions
    .filter((p) => p.status === 'open' && (p.legs[0]?.ticker ?? '').toUpperCase() === symbol)
    .sort((a, b) => a.id.localeCompare(b.id));

  /** The leg the `pos_*` params are read off — the SAME selection rule at every position count. */
  const legOf = (p: SimPosition): Leg | null => {
    const s = evalSubjectOf(p);
    return s.kind === 'none' ? null : (p.legs.find((l) => l.id === s.leg_id) ?? null);
  };

  if (open.length === 0) {
    return {
      position: null,
      queryLeg: null,
      subject: { kind: 'none', reason: 'no_option_leg' },
      suppressed: true,
    };
  }
  if (open.length === 1) {
    const only = open[0];
    const subject = evalSubjectOf(only);
    // Level 2 (ruling #9): a multi-leg position is suppressed too, and a shares-only position has
    // nothing to evaluate. A single OPTION leg is the one arm that surfaces — byte-identical.
    return {
      position: only,
      queryLeg: legOf(only),
      subject,
      suppressed: subject.kind !== 'whole_position',
    };
  }
  return {
    position: open[0],
    queryLeg: legOf(open[0]),
    subject: { kind: 'none', reason: 'multiple_positions' },
    suppressed: true,
  };
}

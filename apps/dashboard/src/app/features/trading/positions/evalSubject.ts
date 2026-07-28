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
 * text. It is a named union rather than an inline literal so that F18 adds `'multiple_positions'`
 * in ONE line and the compiler propagates the new member to every exhaustive switch.
 *
 * `multiple_positions` is deliberately NOT a member here: it is a TICKER-level fact (>1 open
 * position on the focused ticker) while `evalSubjectOf` is POSITION-level. Within a position,
 * `none` is reachable only when there is no option leg at all.
 */
export type EvalNoneReason = 'no_option_leg';

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

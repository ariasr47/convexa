/**
 * readLayout.ts — the ONE total `(requestState, resultState) -> ReadLayout` mapping (SPEC §2.6,
 * §4.5). `presentationPolicy.ts:4-19` declares FIFTEEN request states and `:20-26` SIX result
 * states, and `deriveAiRecPresentation` (`:106-181`) assigns them in two INDEPENDENT statements
 * (`:115-126` and `:128-136`) — nothing makes them mutually exclusive. The space this mapping must
 * cover is therefore the whole **15 x 7** grid (six result states plus `null`), not a list of
 * fifteen alternatives. Canon 16 names nine states; this module does not introduce a ninth-plus-one
 * flat enum — that shape is exactly what produced the spec's own corrected factual error about
 * `no_edge` (§4.5's "correction carried in").
 *
 * `ReadLayout` is a BODY plus its ANNEXES, not one name: *stale* (A5) and the full-analysis drawer
 * (A9) already compose OVER a produced read, and the quiet-gate note (A1c) joins them for the same
 * mechanical reason — it is a REQUEST-scope condition, and the request axis is computed
 * independently of the result axis.
 *
 * Both switches below carry a `never` default arm, so a sixteenth request state or a seventh result
 * state is a COMPILE ERROR at this mapping, never a silent fall-through to `idle` — see
 * `readLayout.spec.ts` for the compile-time proof and its mutation record.
 */
import type { AiRecRequestState, AiRecResultState } from './presentationPolicy';

/** The ten EXCLUSIVE body cases (canon-16 names, A6 split into its two non-collapsing renders). */
export type BodyCase = 'A1a' | 'A1b' | 'A2' | 'A3' | 'A4' | 'A6a' | 'A6b' | 'A7' | 'A8' | 'A10';

/** The three annexes that COMPOSE over a produced body rather than replacing it. */
export type Annex = 'A5' | 'A9' | 'A1c';

export interface ReadLayout {
  body: BodyCase;
  annexes: Annex[];
}

/**
 * Exported ONLY so `readLayout.spec.ts` can exercise the SAME never-arm technique this module's
 * own default arms call — proving, at the call site, that widening `AiRecRequestState` by one
 * member is a compile error wherever this guard is used (liveClaim.typeproof.spec.ts precedent).
 */
export function assertNeverRequestState(value: never): never {
  throw new Error(`readLayoutFor: unhandled request state ${String(value)}`);
}

/** Same contract as {@link assertNeverRequestState}, for the result axis. */
export function assertNeverResultState(value: never): never {
  throw new Error(`readLayoutFor: unhandled result state ${String(value)}`);
}

/**
 * Body for a non-null result state. `stale_newer_snapshot` / `stale_at_generation` /
 * `superseded_inputs` are assigned by `presentationPolicy.ts` BEFORE the `decision === 'no_trade'`
 * check (`:130-133`), so a stale/superseded read CAN underlie either a trade or a no-trade verdict —
 * information this two-axis mapping does not carry (the real `strategy.decision` is a THIRD fact,
 * outside the (request, result) grid). This function returns 'A3' as the canonical stale/superseded
 * body, matching the one case the council actually reasoned about (a stale TRADE read renders the
 * same primary line as a fresh one, correctly — the reviewer-probe note in SPEC §4.5). The
 * PRODUCTION render path (`DecisionCard.tsx`'s `isTrade`) does not consult this function; it reads
 * `rec.strategy.decision` directly and therefore renders the correct verdict word (A3 or A4) even in
 * the theoretical stale-no-trade corner this pure mapping cannot see. This function's job is only to
 * prove the ANNEX (A5) is attached to a produced body — never to re-derive the verdict word.
 */
function bodyForResult(resultState: AiRecResultState): BodyCase {
  switch (resultState) {
    case 'fresh_trade':
      return 'A3';
    case 'no_trade':
      return 'A4';
    case 'stale_newer_snapshot':
    case 'stale_at_generation':
    case 'superseded_inputs':
      return 'A3';
    case 'incomplete_trade':
      // Only reachable on a trade decision (presentationPolicy.ts:134: `decision === 'trade'`).
      return 'A3';
    default:
      return assertNeverResultState(resultState);
  }
}

/** The full-analysis drawer (A9) composes over EVERY produced body (`actions.analysis = produced`,
 *  presentationPolicy.ts:176) — it is a standing affordance, not a state this mapping can toggle
 *  open/closed (that is a UI boolean, not a fact of either axis). *Stale* (A5) additionally composes
 *  over the three degraded result states. */
function annexesForResult(resultState: AiRecResultState): Annex[] {
  switch (resultState) {
    case 'fresh_trade':
    case 'no_trade':
    case 'incomplete_trade':
      return ['A9'];
    case 'stale_newer_snapshot':
    case 'stale_at_generation':
    case 'superseded_inputs':
      return ['A5', 'A9'];
    default:
      return assertNeverResultState(resultState);
  }
}

/**
 * The ONE total mapping. Order of decisions, fixed so the `never` arm never has to invent
 * behaviour (SPEC §2.6's "which axis picks the body"):
 *
 * 1. `loading` / `signed_out` are BODY-REPLACING for all seven result values (the host suppresses
 *    the produced body under both, `AiRecPanel.tsx:387`).
 * 2. For the other thirteen request states, a non-null result state picks the body from the
 *    RESULT axis; `no_edge` is the only one of those thirteen that contributes anything on top
 *    (the A1c annex) — every other reachable-or-unreachable pair in this branch contributes
 *    nothing, matching SPEC §2.6's table row for row exactly.
 * 3. A null result state picks the body from the REQUEST axis.
 */
export function readLayoutFor(
  requestState: AiRecRequestState,
  resultState: AiRecResultState | null,
): ReadLayout {
  if (requestState === 'loading') return { body: 'A2', annexes: [] };
  if (requestState === 'signed_out') return { body: 'A7', annexes: [] };

  if (resultState !== null) {
    const body = bodyForResult(resultState);
    const annexes = annexesForResult(resultState);
    return requestState === 'no_edge' ? { body, annexes: [...annexes, 'A1c'] } : { body, annexes };
  }

  switch (requestState) {
    case 'idle':
      return { body: 'A1a', annexes: [] };
    case 'no_edge':
      return { body: 'A1b', annexes: [] };
    case 'cooldown':
      return { body: 'A6a', annexes: [] };
    case 'daily_cap':
      return { body: 'A6b', annexes: [] };
    case 'unavailable':
      return { body: 'A10', annexes: [] };
    case 'missing_key':
    case 'key_unusable':
    case 'key_rejected':
    case 'model_not_in_catalog':
    case 'model_unset':
    case 'oauth_expired':
    case 'oauth_unlinked':
    case 'subscription_unavailable':
      return { body: 'A8', annexes: [] };
    default:
      return assertNeverRequestState(requestState);
  }
}

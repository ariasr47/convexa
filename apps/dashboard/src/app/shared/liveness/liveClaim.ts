/**
 * `LiveClaim` — the ONE liveness *claim* predicate, made unrepresentable to violate (SPEC §2.1).
 *
 * WHY A BRAND. Phase 1 FAILed GATE Q with a fully green suite (ledger key `one-liveness-predicate`)
 * because two expressions answered "is this live?". Four answered it across the surfaces this phase
 * folds into one panel. A plain `boolean` prop cannot tell a caller's hand-written `&&` chain from
 * the canon predicate; a nominal type can, at COMPILE TIME, with no runtime cost and no `expect`.
 *
 * MODULE PLACEMENT (PLAN U-2). SPEC §2.1 names `isDeliveringLive` (`pages/ticker/sessionTapeStanding.ts`)
 * as the canon predicate AND requires `Widget.live` (`shared/ui/`) to carry the brand. A `shared/` →
 * `pages/` import inverts the repo's binding dependency direction, so the predicate and its brand live
 * HERE and `sessionTapeStanding.ts` re-exports them. "Produced only inside that module" is unchanged:
 * this file is that module.
 */
import type { LiveUpdate } from '@convexa/api';

declare const LIVE_CLAIM: unique symbol;

/**
 * A boolean that can ONLY be produced by `isDeliveringLive` / `andPresent` below. A raw `true`,
 * a `&&` chain, or a store flag will not type-check where this is expected.
 */
export type LiveClaim = boolean & { readonly [LIVE_CLAIM]: 'delivering-live' };

/** The only mint. Private — every export below routes through it. */
const claim = (v: boolean): LiveClaim => v as LiveClaim;

/** The NOT-live claim, for call sites that are structurally never live (a bundle-only figure). */
export const NOT_LIVE: LiveClaim = claim(false);

/** Session-tape occupancy, read without importing `pages/`. Mirrors `sessionTapeStanding.sessionTapeOf`. */
function hasSessionTape(live: LiveUpdate | null | undefined): boolean {
  if (!live) return false;
  return (live as LiveUpdate & { session_tape?: unknown }).session_tape != null;
}

/**
 * The canon predicate, moved verbatim from `sessionTapeStanding.ts:54-60` — behaviour byte-identical,
 * return type narrowed to the brand.
 *
 * Deliberately NOT `genuineIsLive`: that one does not check `market_session`, so it reads `true` while
 * the venue is closed and the wire's `live` flag is stale-but-true — a combination `apps/api/src/
 * routes/stream.rs` makes reachable from the real wire, not merely from a fixture. Deliberately NOT
 * `numbersActive`/`displayActive`: those answer "should figures show a moving number at all" (true
 * during session-tape replay, by design), which is strictly broader than "is this the live stream".
 */
export function isDeliveringLive(live: LiveUpdate | null, streamOffline: boolean): LiveClaim {
  if (hasSessionTape(live)) return NOT_LIVE;
  if (streamOffline) return NOT_LIVE;
  if (!live) return NOT_LIVE;
  if (live.market_session === 'closed') return NOT_LIVE;
  return claim(live.live === true);
}

/**
 * "Live AND this value is present", preserving the brand. THE REASON THIS EXISTS: hand-written
 * `&& value != null` chains at call sites are exactly how the extra expressions were born
 * (`LiveTape.tsx:161,173,189` each write one today). Composing here keeps one answer.
 */
export function andPresent(base: LiveClaim, value: unknown): LiveClaim {
  return claim(Boolean(base) && value != null);
}

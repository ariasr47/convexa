/**
 * INVARIANT 1 (SPEC §7) — the brand is a COMPILE-TIME guarantee. There is no runtime `expect` that can
 * see it, so the proof is `@ts-expect-error`: if the brand is ever removed (or `LiveClaim` widened back
 * to `boolean`), these lines stop being errors and TypeScript raises **TS2578 "Unused
 * '@ts-expect-error' directive"** — `npm run typecheck` goes red. `nx test` stays green, which is
 * exactly why constraint 3 records the two exit codes separately.
 */
import { describe, expect, it } from 'vitest';
import { isDeliveringLive, NOT_LIVE, type LiveClaim } from './liveClaim';

function takesClaim(claim: LiveClaim): void {
  expect(typeof claim).toBe('boolean'); // uses the param so it is never flagged unused
}

describe('LiveClaim — nominal brand', () => {
  it('a raw boolean cannot inhabit a liveness prop', () => {
    // Non-literal operands (ESLint's no-constant-binary-expression would flag `Boolean(1) && 2 !=
    // null` as a compile-time-constant `&&` — the point here is the SHAPE (a hand-written boolean
    // chain), not a literal, so read them from a widened, non-const source.
    const someValue: number | null = Date.now() > 0 ? 2 : null;
    // @ts-expect-error a hand-written `true` is not a claim produced by the canon predicate
    takesClaim(true);
    // @ts-expect-error a `&&` chain is not a claim — this is how the extra expressions were born
    takesClaim(Boolean(someValue) && someValue != null);
    // The two legal producers compile with no directive:
    takesClaim(NOT_LIVE);
    takesClaim(isDeliveringLive(null, false));
  });
});

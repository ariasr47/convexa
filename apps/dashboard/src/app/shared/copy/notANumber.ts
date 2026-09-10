/**
 * `NotANumber` — the ONE closed not-a-number vocabulary (`[absent-is-not-none]`, canon rule 24 as
 * amended by ruling 3 to the shipped NINE).
 *
 * Seeded from the SHIPPED DECLARATION SITES, not from a count: the canon's six plus three that are
 * spec-pinned as NON-SYNONYMOUS —
 *   `not recorded`  the saved record never held this fact (positions)
 *   `no basis`      the cost-basis denominator is absent while the dollar figure renders fine
 *   `not provided`  the feed did not send it (broker)
 * A six-member union would be worse than useless: a seventh literal is not a type error, it is a
 * plain `string` that falls into the MONO figure register — the exact inversion the register exists
 * to prevent.
 *
 * THE TYPE ENFORCES CLOSURE; THE CALLER PICKS THE MEMBER. Members never substitute for one another
 * — `brokerView.ts` substitutes NOT_RECORDED → NOT_PROVIDED per surface BY DESIGN, because a
 * broker's non-disclosure must not be reported as our record being empty.
 *
 * MODULE PLACEMENT (PLAN U-3): `FigureCell` lives in `pages/ticker/widgets/_kit/` per SPEC §2.3,
 * but this union's three existing consumers (`positions/labels.ts`, `positions/view.ts`,
 * `broker/brokerView.ts`) all live under `features/trading/`. A `features/` → `pages/` import would
 * invert the repo's binding dependency direction (`pages`/`features` → `shared`), so the union — a
 * shape §2.3 never names a module for — lands here instead, where its three day-one consumers
 * already justify `shared/` under the repo's own "populate on the 2nd consumer" rule.
 */

export const NOT_A_NUMBER = [
  '—',
  'unavailable',
  'not given',
  'not set',
  'size not suggested',
  'unrecognized',
  'not recorded',
  'no basis',
  'not provided',
] as const;

export type NotANumber = (typeof NOT_A_NUMBER)[number];

/** Runtime membership. A string that is not a member CANNOT reach the literal branch. */
export function isNotANumber(v: string): v is NotANumber {
  return (NOT_A_NUMBER as readonly string[]).includes(v);
}

/** The three re-pointed constants — one source of truth instead of four. */
export const NOT_RECORDED: NotANumber = 'not recorded';
export const NO_BASIS_LABEL: NotANumber = 'no basis';
export const NOT_PROVIDED: NotANumber = 'not provided';

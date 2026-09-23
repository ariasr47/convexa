/**
 * curvature-v2-landing-and-site — sample-figure equality (PLAN.md F14; SPEC.md §7 item 14).
 *
 * Homed OUTSIDE the `pages` tree, same reasoning as
 * `curvature-v2-landing-and-site.structural.spec.ts` (F13): the deny-list in `eslint.config.mjs`
 * scopes to files under `pages/landing`, `pages/blog`, `pages/methodology` and `pages/not-found` —
 * not this file, which sits directly under `src/app` — so a spec here can import the ticker's
 * projection as a READ-ONLY REFERENCE without tripping the "pages never import sibling pages" rule.
 * No ticker file is edited by this feature, and `ScoreStripSample.tsx` keeps its own local mirror
 * (`percentOnly`) rather than this import.
 *
 * This pins `FLIP_DISTANCE_LABEL` (derived at module load from `samples.ts` inside
 * `pages/landing/ScoreStripSample.tsx`) equal to what the shipped desk projection
 * (`pages/ticker/widgets/_kit/distanceToLevel.ts`'s `distancePercentOnly`) produces from the SAME
 * `LANDING_SAMPLE` constants — proof the landing sample is DERIVED, not hand-typed, and is neither of
 * the two values the design artboard prints (`landing.mjs:65,88`).
 */
import { FLIP_DISTANCE_LABEL } from '@/pages/landing/ScoreStripSample';
import { LANDING_SAMPLE } from '@/pages/landing/samples';
import { distancePercentOnly } from '@/pages/ticker/widgets/_kit/distanceToLevel';
import { describe, expect, it } from 'vitest';

describe('§7 item 14 — the landing sample is DERIVED, not hand-typed', () => {
  it('equals the shipped desk projection over the same constants', () => {
    expect(FLIP_DISTANCE_LABEL).toBe(
      distancePercentOnly(LANDING_SAMPLE.gammaFlip, LANDING_SAMPLE.spot),
    );
  });

  it('and it is neither of the artboard-printed values, which is the point', () => {
    expect(FLIP_DISTANCE_LABEL).toBe('−0.8%');
    expect(FLIP_DISTANCE_LABEL).not.toBe('−0.81%'); // `landing.mjs:88`
  });

  it('MUTATION GUARD: poison a constant and the rendered string must move', () => {
    expect(distancePercentOnly(568.5, 573.12)).toBe('−0.8%');
    expect(distancePercentOnly(560, 573.12)).not.toBe('−0.8%');
  });
});

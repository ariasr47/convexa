/**
 * readLayout.spec.ts — the exhaustiveness proof for the total `(requestState, resultState) ->
 * ReadLayout` mapping (SPEC §2.6, PLAN FE-9 Step 4, invariant 5).
 *
 * Three layers, each named in PLAN:
 * 1. A table-driven walk of all 15 x 7 = 105 pairs (six result states plus `null`), asserting a
 *    defined `ReadLayout` for every one and that its body matches an INDEPENDENTLY written
 *    reference table (not a re-import of `readLayout.ts`'s own switches) — so a mutation inside
 *    `readLayoutFor` has something to disagree with.
 * 2. A compile-time proof that widening either union by one member is a TypeScript error at the
 *    exact mechanism `readLayoutFor`'s own default arms use (`assertNeverRequestState` /
 *    `assertNeverResultState`), mirroring `liveClaim.typeproof.spec.ts`'s established call-site
 *    idiom (TS2578 "unused @ts-expect-error" is the regression signal, not a runtime `expect`).
 * 3. The runtime companion PLAN calls "the point": a REAL fixture at `(no_edge, fresh_trade)`
 *    proving the pair is reachable through `deriveAiRecPresentation` (not merely assignable at the
 *    type level) and that the mapping attaches the A1c annex to a produced body. The DOM proof that
 *    both actually RENDER lives in `readLayout.render.spec.tsx` (criterion 58).
 */
import type { RecCap } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import { noTradeRec, recAllTraced } from './fixtures';
import {
  deriveAiRecPresentation,
  type AiRecRequestState,
  type AiRecResultState,
  type PresentationInput,
} from './presentationPolicy';
import {
  assertNeverRequestState,
  assertNeverResultState,
  readLayoutFor,
  type Annex,
  type BodyCase,
} from './readLayout';

const REQUEST_STATES: AiRecRequestState[] = [
  'idle',
  'loading',
  'signed_out',
  'missing_key',
  'key_unusable',
  'key_rejected',
  'model_not_in_catalog',
  'model_unset',
  'oauth_expired',
  'oauth_unlinked',
  'subscription_unavailable',
  'cooldown',
  'daily_cap',
  'no_edge',
  'unavailable',
];

const RESULT_STATES: AiRecResultState[] = [
  'fresh_trade',
  'no_trade',
  'stale_newer_snapshot',
  'stale_at_generation',
  'superseded_inputs',
  'incomplete_trade',
];

const KEY_STATES: AiRecRequestState[] = [
  'missing_key',
  'key_unusable',
  'key_rejected',
  'model_not_in_catalog',
  'model_unset',
  'oauth_expired',
  'oauth_unlinked',
  'subscription_unavailable',
];

/** Independently written reference — SPEC §2.6's "which axis picks the body" table, transcribed by
 *  hand, not derived from `readLayout.ts`. */
function expectedBody(
  requestState: AiRecRequestState,
  resultState: AiRecResultState | null,
): BodyCase {
  if (requestState === 'loading') return 'A2';
  if (requestState === 'signed_out') return 'A7';
  if (resultState !== null) {
    if (resultState === 'fresh_trade') return 'A3';
    if (resultState === 'no_trade') return 'A4';
    return 'A3'; // stale_newer_snapshot / stale_at_generation / superseded_inputs / incomplete_trade
  }
  if (requestState === 'idle') return 'A1a';
  if (requestState === 'no_edge') return 'A1b';
  if (requestState === 'cooldown') return 'A6a';
  if (requestState === 'daily_cap') return 'A6b';
  if (requestState === 'unavailable') return 'A10';
  if (KEY_STATES.includes(requestState)) return 'A8';
  throw new Error(`no reference body for ${requestState}`);
}

function expectedAnnexes(
  requestState: AiRecRequestState,
  resultState: AiRecResultState | null,
): Annex[] {
  if (requestState === 'loading' || requestState === 'signed_out') return [];
  if (resultState === null) return [];
  const annexes: Annex[] = ['A9'];
  if (
    resultState === 'stale_newer_snapshot' ||
    resultState === 'stale_at_generation' ||
    resultState === 'superseded_inputs'
  ) {
    annexes.push('A5');
  }
  if (requestState === 'no_edge') annexes.push('A1c');
  return annexes;
}

describe('readLayoutFor — the total 15 x 7 mapping', () => {
  const pairs: Array<[AiRecRequestState, AiRecResultState | null]> = [];
  for (const req of REQUEST_STATES) {
    pairs.push([req, null]);
    for (const res of RESULT_STATES) pairs.push([req, res]);
  }

  it('covers exactly 105 pairs (15 request states x (6 result states + null))', () => {
    expect(REQUEST_STATES).toHaveLength(15);
    expect(RESULT_STATES).toHaveLength(6);
    expect(pairs).toHaveLength(105);
  });

  it.each(pairs)('returns a defined ReadLayout for (%s, %s)', (req, res) => {
    const layout = readLayoutFor(req, res);
    expect(layout.body).toBe(expectedBody(req, res));
    expect(layout.annexes.slice().sort()).toEqual(expectedAnnexes(req, res).slice().sort());
  });

  it('no_edge is the ONLY request state that adds A1c, and only when resultState is non-null', () => {
    for (const req of REQUEST_STATES) {
      for (const res of RESULT_STATES) {
        const hasAnnex = readLayoutFor(req, res).annexes.includes('A1c');
        expect(hasAnnex).toBe(req === 'no_edge');
      }
      expect(readLayoutFor(req, null).annexes.includes('A1c')).toBe(false);
    }
  });

  it('daily_cap and cooldown contribute nothing on top of a produced body (D-15, unchanged this phase)', () => {
    const capped = readLayoutFor('daily_cap', 'fresh_trade');
    const cooling = readLayoutFor('cooldown', 'fresh_trade');
    expect(capped).toEqual({ body: 'A3', annexes: ['A9'] });
    expect(cooling).toEqual({ body: 'A3', annexes: ['A9'] });
  });

  it('A10 (unavailable) never composes — resultState is structurally null whenever rec.status is unavailable', () => {
    // presentationPolicy.ts:128 only assigns a non-null resultState when `produced` is true, and
    // `produced` requires `rec.status === 'produced'` (:108) — mutually exclusive with `unavailable`
    // (:102-103). This is documented, not merely asserted: the mapping itself still returns a sane,
    // defined value for the type-level pairs that can never occur at runtime (total means total).
    expect(readLayoutFor('unavailable', null)).toEqual({ body: 'A10', annexes: [] });
  });
});

describe('readLayoutFor — compile-time exhaustiveness (mirrors liveClaim.typeproof.spec.ts)', () => {
  type ExtendedRequestState = AiRecRequestState | 'made_up_request_state';
  type ExtendedResultState = AiRecResultState | 'made_up_result_state';

  /** Reproduces the SAME exhaustive-switch-plus-never-arm shape `readLayoutFor`'s own default arm
   *  uses, over a WIDENED local copy of the union, so the failure is attributable to the exact
   *  mechanism this module relies on — not merely to the outer function's parameter type. */
  function forgedRequestSwitch(state: ExtendedRequestState): void {
    switch (state) {
      case 'idle':
      case 'loading':
      case 'signed_out':
      case 'missing_key':
      case 'key_unusable':
      case 'key_rejected':
      case 'model_not_in_catalog':
      case 'model_unset':
      case 'oauth_expired':
      case 'oauth_unlinked':
      case 'subscription_unavailable':
      case 'cooldown':
      case 'daily_cap':
      case 'no_edge':
      case 'unavailable':
        return;
      default:
        // @ts-expect-error — a 16th request-state member is not assignable to `never`. If this stops
        // erroring (the union widened without this guard noticing), TS raises TS2578 ("unused
        // '@ts-expect-error' directive") and `npm run typecheck` goes red — the same signal
        // `liveClaim.typeproof.spec.ts` relies on. This calls the REAL exported guard, so it proves
        // the exact function `readLayoutFor`'s own default arm invokes would fail to compile too.
        assertNeverRequestState(state);
    }
  }

  function forgedResultSwitch(state: ExtendedResultState): void {
    switch (state) {
      case 'fresh_trade':
      case 'no_trade':
      case 'stale_newer_snapshot':
      case 'stale_at_generation':
      case 'superseded_inputs':
      case 'incomplete_trade':
        return;
      default:
        // @ts-expect-error — a 7th result-state member is not assignable to `never` (same mechanism).
        assertNeverResultState(state);
    }
  }

  it('the never-arm guards exist and throw at runtime if ever actually reached', () => {
    forgedRequestSwitch('idle');
    forgedResultSwitch('fresh_trade');
    // @ts-expect-error — exercised only for the type-level proof above; not a reachable runtime path.
    expect(() => assertNeverRequestState('not-a-real-state')).toThrow(/unhandled request state/);
    // @ts-expect-error — same, for the result axis.
    expect(() => assertNeverResultState('not-a-real-state')).toThrow(/unhandled result state/);
  });
});

describe('readLayoutFor — the runtime companion at (no_edge, fresh_trade)', () => {
  const cap: RecCap = { over_limit: false, remaining_today: 1, resets_at: '' };
  const baseInput = (overrides: Partial<PresentationInput> = {}): PresentationInput => ({
    rec: null,
    loading: false,
    stale: false,
    signedIn: true,
    canCreateOrder: true,
    inAppEnabled: true,
    cap,
    cooldownRemaining: 0,
    readinessGateState: 'available',
    scenarioSelected: false,
    currentRiskInputs: null,
    ...overrides,
  });

  it('(no_edge, fresh_trade) is REACHABLE through deriveAiRecPresentation, not merely type-assignable', () => {
    // A produced, pinned trade (the fixture's default decision) whose readiness gate has since
    // closed — "the market moved after I got my read" (SPEC §4.5's own framing of the corrected
    // no_edge disposition). `presentationPolicy.ts:125` reads `readinessGateState` independently of
    // `rec.status`, so this is genuinely reachable today, not a synthetic type-only pair.
    const presentation = deriveAiRecPresentation(
      baseInput({ rec: recAllTraced(), readinessGateState: 'no_fresh_edge' }),
    );
    expect(presentation.requestState).toBe('no_edge');
    expect(presentation.resultState).toBe('fresh_trade');

    const layout = readLayoutFor(presentation.requestState, presentation.resultState);
    expect(layout.body).toBe('A3');
    expect(layout.annexes).toContain('A1c');

    // Row 59: the annex composes; refresh/retry both resolve false, askAnyway is the only recovery
    // control (presentationPolicy.ts:169,177 vs :168).
    expect(presentation.actions.askAnyway).toBe(true);
    expect(presentation.actions.refresh).toBe(false);
    expect(presentation.actions.retry).toBe(false);
  });

  it('(no_edge, no_trade) is likewise reachable and maps to A4 + the A1c annex', () => {
    const presentation = deriveAiRecPresentation(
      baseInput({ rec: noTradeRec(), readinessGateState: 'no_fresh_edge' }),
    );
    expect(presentation.requestState).toBe('no_edge');
    expect(presentation.resultState).toBe('no_trade');
    const layout = readLayoutFor(presentation.requestState, presentation.resultState);
    expect(layout).toEqual({ body: 'A4', annexes: ['A9', 'A1c'] });
  });

  it('MUTATION PROOF (b): a wrong destination for (no_edge, fresh_trade) is what row 58 exists to catch', () => {
    // Poisoned reference: the earlier, corrected spec draft's claim that no_edge "lives inside the
    // idle body phase by construction" — i.e. treating it as if resultState were always null here.
    const wrongLayout: { body: BodyCase; annexes: Annex[] } = { body: 'A1a', annexes: [] };
    const realLayout = readLayoutFor('no_edge', 'fresh_trade');
    expect(realLayout).not.toEqual(wrongLayout);
    expect(realLayout.body).not.toBe('A1a');
  });
});

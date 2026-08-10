/**
 * TECH_DEBT #20 — the five FUTURE copy exports in `positions/labels.ts` (SPEC §4 "Future
 * copy", positions-legs) are deliberately defined-but-UNWIRED pending the alert surface
 * (`useGhostTrade`'s `alerts` has no component consumer — OPEN_THREADS §7x deferred seams).
 *
 * This spec turns that prose rule (PLAN F6 Step 5's manual grep) into a standing structural
 * check, in both directions:
 *   1. the five exports EXIST and are non-empty — deleting them is the forbidden fix
 *      ("the fix for a match elsewhere is to unwire the consumer, never to delete the
 *      constant"), and
 *   2. NO app source outside `labels.ts` references them — wiring one is the deliberate
 *      alert-surface feature, not a drive-by. When that feature lands, update the FUTURE
 *      banner in `labels.ts` AND this spec together.
 *
 * Idiom: root-anchored `import.meta.glob(?raw)` over non-spec app sources, as in
 * `shared/theme/banned-hexes.spec.ts`. The final test doubles as the mutation guard —
 * it proves the scanner sees the one file that legitimately carries all five names.
 */
import { describe, expect, it } from 'vitest';

import * as labels from './labels';

const FUTURE_NAMES = [
  'POSITION_EVAL_LEG_QUALIFIER',
  'POSITION_EVAL_TIP',
  'POSITION_EVAL_NONE_EQUITY',
  'POSITION_EVAL_NONE_SHORT',
  'POSITION_EVAL_NONE_MULTI_POSITION',
] as const;

const LABELS_PATH = '/src/app/features/trading/positions/labels.ts';

const APP_SOURCES = import.meta.glob(['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('future copy stays defined-but-unwired (pending the alert surface)', () => {
  it('all five exports exist in labels.ts and are non-empty', () => {
    const bag = labels as Record<string, unknown>;
    expect(typeof bag.POSITION_EVAL_LEG_QUALIFIER).toBe('function');
    expect(
      (bag.POSITION_EVAL_LEG_QUALIFIER as (l: string, n: number) => string)('long call', 4),
    ).toContain('long call');
    for (const name of FUTURE_NAMES.filter((n) => n !== 'POSITION_EVAL_LEG_QUALIFIER')) {
      expect(typeof bag[name], `${name} must stay exported`).toBe('string');
      expect((bag[name] as string).length, `${name} must stay non-empty`).toBeGreaterThan(0);
    }
  });

  it('no app source outside positions/labels.ts references any of the five', () => {
    const offenders: string[] = [];
    for (const [path, source] of Object.entries(APP_SOURCES)) {
      if (path === LABELS_PATH) continue;
      for (const name of FUTURE_NAMES) {
        if (source.includes(name)) offenders.push(`${path} → ${name}`);
      }
    }
    expect(
      offenders,
      'A FUTURE copy string gained a consumer. If the alert surface is landing deliberately, ' +
        'move its name out of FUTURE_NAMES here and out of the FUTURE banner in labels.ts; ' +
        'otherwise unwire the consumer.',
    ).toEqual([]);
  });

  it('mutation guard: the glob sees labels.ts carrying all five names', () => {
    const labelsRaw = APP_SOURCES[LABELS_PATH] ?? '';
    for (const name of FUTURE_NAMES) {
      expect(labelsRaw, `scanner must see ${name} in ${LABELS_PATH}`).toContain(name);
    }
  });
});

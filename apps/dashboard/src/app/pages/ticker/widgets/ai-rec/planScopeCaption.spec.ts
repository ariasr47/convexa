import type { RecResponse } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import {
  noTradeRec,
  recAllTraced,
  recBlockAbsent,
  recLocalRules,
  recLocalRulesNothingCheckable,
} from './fixtures';
import { shouldShowPlanFieldsNotChecked } from './planScopeCaption';

describe('shouldShowPlanFieldsNotChecked', () => {
  it('shows the caption whenever a trade plan mounts, except on an affirmative local_rules card; never reads key_source or field content', () => {
    const rows: ReadonlyArray<[string, () => RecResponse, boolean]> = [
      ['produced trade with a non-local_rules card (AC-1)', recAllTraced, true],
      [
        'local_rules, even with shared_admin key_source (AC-2 / D2)',
        () => {
          const rec = recLocalRules();
          (rec as { key_source?: string }).key_source = 'shared_admin';
          rec.remaining_free_uses = 2;
          return rec;
        },
        false,
      ],
      ['not_applicable accept-show residual (AC-2r / D4)', recLocalRulesNothingCheckable, true],
      ['grounding block missing (missing is never an exemption)', recBlockAbsent, true],
      ['no_trade (AC-5)', noTradeRec, false],
      [
        'unrecognized card token when the trade plan would mount',
        () => {
          const rec = recAllTraced();
          (rec.grounding as { card: string }).card = 'future_unknown_token';
          return rec;
        },
        true,
      ],
      [
        'bare/stated plan-field content is ignored (D1 — not a content heuristic)',
        () => {
          const bare = recAllTraced();
          bare.strategy = {
            ...bare.strategy!,
            structure: null,
            strikes: [],
            expiration: null,
            entry_trigger: null,
            time_horizon: null,
            confidence: null,
          };
          return bare;
        },
        true,
      ],
    ];
    for (const [name, build, shown] of rows) {
      expect(shouldShowPlanFieldsNotChecked(build()), name).toBe(shown);
    }
  });
});

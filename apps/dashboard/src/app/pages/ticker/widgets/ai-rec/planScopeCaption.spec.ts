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
  it('shows on produced trade with non-local_rules card (AC-1)', () => {
    expect(shouldShowPlanFieldsNotChecked(recAllTraced())).toBe(true);
  });

  it('hides on local_rules even with shared_admin key_source (AC-2 / D2)', () => {
    const rec = recLocalRules();
    (rec as { key_source?: string }).key_source = 'shared_admin';
    rec.remaining_free_uses = 2;
    expect(rec.grounding!.card).toBe('local_rules');
    expect(rec.key_source).not.toBe('none');
    expect(shouldShowPlanFieldsNotChecked(rec)).toBe(false);
  });

  it('shows on not_applicable accept-show residual (AC-2r / D4)', () => {
    expect(shouldShowPlanFieldsNotChecked(recLocalRulesNothingCheckable())).toBe(true);
  });

  it('shows when grounding block is missing (missing is never an exemption)', () => {
    expect(shouldShowPlanFieldsNotChecked(recBlockAbsent())).toBe(true);
  });

  it('hides on no_trade (AC-5)', () => {
    expect(shouldShowPlanFieldsNotChecked(noTradeRec())).toBe(false);
  });

  it('shows on unrecognized card token when trade plan would mount', () => {
    const rec = recAllTraced();
    (rec.grounding as { card: string }).card = 'future_unknown_token';
    expect(shouldShowPlanFieldsNotChecked(rec)).toBe(true);
  });

  it('does not read key_source (source pin)', () => {
    expect(String(shouldShowPlanFieldsNotChecked)).not.toMatch(/key_source/);
  });

  it('ignores bare/stated plan-field content (D1 — not a content heuristic)', () => {
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
    expect(shouldShowPlanFieldsNotChecked(bare)).toBe(true);
  });
});

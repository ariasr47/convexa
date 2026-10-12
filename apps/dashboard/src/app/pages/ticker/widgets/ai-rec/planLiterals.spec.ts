/**
 * planLiterals.spec.ts — rec-absence-literals-hole. `planFieldLiteral`, the sibling selector for the
 * six plan/conviction fields, whose fallthrough and off-scale handling are the whole point of the
 * feature. `fieldLiteral` / `literals.spec.ts` are read here only to prove they stay untouched.
 */
import { describe, expect, it } from 'vitest';
import { fieldLiteral, planFieldLiteral } from './literals';

const trade = 'trade' as const;

describe('rec-absence-literals-hole · planFieldLiteral (the sibling selector)', () => {
  it('THE DEFAULTS DIFFER — this is the whole point, and a later merge must red here', () => {
    const args = { decision: trade, value: null, reason: null } as const;
    expect(fieldLiteral(args)).toEqual({ kind: 'unavailable' }); // shipped fallthrough, unchanged
    expect(planFieldLiteral(args)).toEqual({ kind: 'not_given' }); // sibling fallthrough
  });

  it('a stated value renders through the SHARED value arms, identically to the shipped selector', () => {
    for (const v of ['long call', '5d', 'break above 252']) {
      expect(planFieldLiteral({ decision: trade, value: v, reason: null })).toEqual({
        kind: 'value',
        text: v,
      });
    }
  });

  it('an off-scale conviction renders the ONE new word and never leaks the raw string', () => {
    const l = planFieldLiteral({
      decision: trade,
      value: 'quite high',
      reason: { reason: 'unrecognized_value', missing_input: null },
    });
    expect(l).toEqual({ kind: 'unrecognized' });
    expect(JSON.stringify(l)).not.toContain('quite high');
  });

  it('unavailable renders ONLY from the explicit candidate_set pair, never from a fallthrough', () => {
    expect(
      planFieldLiteral({
        decision: trade,
        value: null,
        reason: { reason: 'unavailable', missing_input: 'candidate_set' },
      }),
    ).toEqual({ kind: 'unavailable' });
    for (const reason of [
      { reason: 'unavailable', missing_input: 'risk_block' },
      { reason: 'not_given', missing_input: null },
      { reason: 'wat' as unknown as 'not_given', missing_input: null },
    ] as const) {
      expect(planFieldLiteral({ decision: trade, value: null, reason })).toEqual({
        kind: 'not_given',
      });
    }
  });

  it('no_trade short-circuits FIRST, before the value is touched', () => {
    expect(planFieldLiteral({ decision: 'no_trade', value: 'long call', reason: null })).toEqual({
      kind: 'dash',
    });
  });

  it('never renders not_set — none of the six depends on owner input (AC-23)', () => {
    const kinds = [
      planFieldLiteral({ decision: trade, value: null, reason: null }),
      planFieldLiteral({
        decision: trade,
        value: '',
        reason: { reason: 'unavailable', missing_input: 'risk_block' },
      }),
    ].map((l) => l.kind);
    expect(kinds).not.toContain('not_set');
  });
});

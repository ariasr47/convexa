/**
 * Unit — the D2 trigger-seed parser matrix (FRONTEND contract §7 "seed.spec.ts"):
 * one level + direction ⇒ seed; two numbers ⇒ empty; number with no direction ⇒ empty; prose only
 * ⇒ empty; the "break above/below/over/under" variants. Never guess (AC-6).
 */
import { describe, expect, it } from 'vitest';
import { parseTriggerSeed } from './seed';

describe('parseTriggerSeed — D2 seed policy (one explicit level + unambiguous direction ONLY)', () => {
  it('seeds underlying_above from "break above {level}" variants', () => {
    expect(parseTriggerSeed('Enter on a break above 252')).toEqual({ kind: 'underlying_above', level: 252 });
    expect(parseTriggerSeed('breaks above 252.50')).toEqual({ kind: 'underlying_above', level: 252.5 });
    expect(parseTriggerSeed('a move over $430')).toEqual({ kind: 'underlying_above', level: 430 });
    expect(parseTriggerSeed('above 1,250')).toEqual({ kind: 'underlying_above', level: 1250 });
  });

  it('seeds underlying_below from "break below / under / breakdown below" variants', () => {
    expect(parseTriggerSeed('Enter on a break below 240')).toEqual({ kind: 'underlying_below', level: 240 });
    expect(parseTriggerSeed('under 240')).toEqual({ kind: 'underlying_below', level: 240 });
    expect(parseTriggerSeed('a breakdown below $239.75')).toEqual({ kind: 'underlying_below', level: 239.75 });
  });

  it('two numbers ⇒ empty (ambiguous, never guess)', () => {
    expect(parseTriggerSeed('Enter above 250 or on a pullback to 245')).toBeNull();
  });

  it('a number with no direction word ⇒ empty', () => {
    expect(parseTriggerSeed('Enter around 250 on confirmation')).toBeNull();
  });

  it('prose only (no numeric level) ⇒ empty', () => {
    expect(parseTriggerSeed('Enter on strength through the call wall')).toBeNull();
    expect(parseTriggerSeed('')).toBeNull();
    expect(parseTriggerSeed(null)).toBeNull();
    expect(parseTriggerSeed(undefined)).toBeNull();
  });

  it('BOTH direction classes present ⇒ empty (ambiguous)', () => {
    expect(parseTriggerSeed('above 250 but not below')).toBeNull();
  });

  it('non-positive / non-finite levels never seed', () => {
    expect(parseTriggerSeed('above 0')).toBeNull();
  });
});

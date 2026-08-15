/**
 * prefill.absence.spec.ts — rec-absence-literals-hole (PLAN F10). The prefill seam: `biasToRight`'s
 * presence check and `recToPrefill`'s null-for-never-named contract fields.
 */
import type { RecStrategy } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import { biasToRight, recToPrefill } from './prefill';

const named: RecStrategy = {
  decision: 'trade',
  bias: 'long',
  structure: 'long call',
  strikes: [260],
  expiration: '2026-07-18',
  entry_trigger: 'x',
  invalidation_level: 1,
  max_risk: '$1',
  position_size: '1',
  exit_plan: { target: null, stop: null },
  time_horizon: '5d',
  confidence: 'medium',
  rationale: 'r',
};

describe('rec-absence-literals-hole · the prefill seam', () => {
  it('AC-12c — an unnamed structure derives NO direction, even when a bias is stated', () => {
    expect(biasToRight({ structure: null, bias: 'short' })).toBeNull();
    expect(biasToRight({ structure: '   ', bias: 'long' })).toBeNull();
  });

  it('a STATED structure still derives exactly as today (bias fallback included)', () => {
    expect(biasToRight({ structure: 'long put spread', bias: 'long' })).toBe('put');
    expect(biasToRight({ structure: 'long call', bias: 'short' })).toBe('call');
    // Stated but naming neither word: the bias derivation stands UNCHANGED — a parse that found no
    // keyword is a different fact from an unnamed structure, and is out of scope here.
    expect(biasToRight({ structure: 'iron condor', bias: 'short' })).toBe('put');
    expect(biasToRight({ structure: 'iron condor', bias: 'long' })).toBe('call');
  });

  it('AC-12a/b — an unnamed strike/expiration arrive as null, never 0 and never an empty string', () => {
    const pf = recToPrefill({ ...named, strikes: [], expiration: null, structure: null }, 'P', 'c');
    expect(pf?.strike).toBeNull();
    expect(pf?.expiration).toBeNull();
    expect(pf?.right).toBeNull();
  });

  it('AC-12e — the refusal keys on the VALUE, not on a reason token (none is read here)', () => {
    // `recToPrefill` takes no `field_reasons` argument at all — a degraded response with no reason
    // information still refuses to seed, structurally.
    const pf = recToPrefill({ ...named, strikes: [] }, 'P', 'c');
    expect(pf?.strike).toBeNull();
    expect(recToPrefill.length).toBeLessThanOrEqual(4); // no fifth `reasons` parameter appeared
  });

  it('AC-12d — the reason line names the fields and NO cause', () => {
    const pf = recToPrefill({ ...named, strikes: [], expiration: null }, 'P', 'c');
    expect(pf?.contractWithheldReason).toContain('Strike(s)');
    expect(pf?.contractWithheldReason).toContain('Expiration');
    for (const cause of ['because', 'failed', 'missing', 'AI', 'error'])
      expect(pf?.contractWithheldReason?.toLowerCase()).not.toContain(cause.toLowerCase());
  });

  it('AC-13 — a fully-named rec seeds exactly as today, and carries NO reason line', () => {
    const pf = recToPrefill(named, 'P', 'c');
    expect(pf?.strike).toBe(260);
    expect(pf?.expiration).toBe('2026-07-18');
    expect(pf?.right).toBe('call');
    expect(pf?.contractWithheldReason).toBeNull();
  });
});

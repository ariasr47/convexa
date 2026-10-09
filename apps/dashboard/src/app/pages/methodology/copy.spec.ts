/**
 * `pages/methodology/copy.ts` — colocated unit tests for the data module itself (PLAN.md F9).
 *
 * What earns a TEST here (SPEC §7's risk-based rule): the vocabulary set-equality SPEC §7 item 9
 * names (both directions — a tenth `NotANumber` member without a definition, or a definition for
 * a non-member, must be loud), the three closest vocabulary pairs staying distinct, and the
 * module naming no persona, flows or operator screen (AC-M5b).
 *
 * What is deliberately NOT duplicated here: the score table's `Max` column against
 * `libs/quant-engine/src/signals.rs` (SPEC §7 item 10 / AC-M2) is PLAN.md F13's structural spec
 * (`curvature-v2-landing-and-site.structural.spec.ts`, homed outside `pages/**`). The byte-for-byte
 * provenance check against `design/src/screens/methodology.mjs` (SPEC §7 item 16 / AC-C1a) was
 * retired in lean-tests batch 38 and has no test; this module's strings were hand-verified
 * against the design source with a throwaway extraction script before this file was written.
 * What is F10's job, not this file's: anything that needs a render (deep-link anchor resolution,
 * the vocabulary literal's resolved `font-family`, the on-this-page index).
 */
import { NOT_A_NUMBER } from '@/shared/copy/notANumber';
import { describe, expect, it } from 'vitest';
import { METHOD_COPY, type MethodBlock, type MethodSection } from './copy';

function section(id: string): MethodSection {
  const found = METHOD_COPY.sections.find((s) => s.id === id);
  if (!found) throw new Error(`no section with id "${id}"`);
  return found;
}

function tableBlocks(s: MethodSection): ReadonlyArray<Extract<MethodBlock, { kind: 'table' }>> {
  return s.blocks.filter((b): b is Extract<MethodBlock, { kind: 'table' }> => b.kind === 'table');
}

describe('Vocabulary table (AC-M4 — set-equality in both directions, SPEC §7 item 9)', () => {
  it('carries exactly the NOT_A_NUMBER members — none missing, none extra', () => {
    const [table] = tableBlocks(section('vocabulary'));
    const literalColumn = table.rows.map((r) => r[0]);
    expect(literalColumn).toHaveLength(NOT_A_NUMBER.length);
    expect(new Set(literalColumn)).toEqual(new Set(NOT_A_NUMBER));
  });

  it('separates the three closest pairs: not recorded / not provided / unavailable', () => {
    const [table] = tableBlocks(section('vocabulary'));
    const byLiteral = Object.fromEntries(table.rows.map((r) => [r[0], r[1]]));
    expect(byLiteral['not recorded']).toMatch(/never held this fact/);
    expect(byLiteral['not provided']).toMatch(/the source withheld it/);
    expect(byLiteral['unavailable']).toMatch(/this cycle/);
  });
});

describe('Operator surfaces stay out of the public copy (AC-M5b)', () => {
  it('names no persona, flows or operator screen (AC-M5b)', () => {
    const serialized = JSON.stringify(METHOD_COPY).toLowerCase();
    expect(serialized).not.toMatch(/persona screen|flows screen|operator screen/);
  });
});

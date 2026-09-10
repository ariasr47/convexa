/**
 * `pages/methodology/copy.ts` — colocated unit tests for the data module itself (PLAN.md F9).
 *
 * What earns a TEST here (SPEC §7's risk-based rule): the shape invariant PLAN D1 exists to
 * guarantee (the discriminated union is at the BLOCK level, so a table can never render as
 * prose and the index can never diverge from the body), the vocabulary set-equality SPEC §7
 * item 9 names (both directions — a tenth `NotANumber` member without a definition, or a
 * definition for a non-member, must be loud), and that the three quoted deltas (AC-C1) and the
 * nine retired v1 fragments (AC-C1a's negative half) land/don't-land exactly as the rewrite
 * intends.
 *
 * What is deliberately NOT duplicated here: the byte-for-byte provenance check against
 * `design/src/screens/methodology.mjs` (SPEC §7 item 16 / AC-C1a) and the score table's `Max`
 * column against `libs/quant-engine/src/signals.rs` (SPEC §7 item 10 / AC-M2) are PLAN.md F13's
 * named, separately-committed structural spec (`curvature-v2-landing-and-site.structural.spec.ts`,
 * homed outside `pages/**`, depends on F9). Building a second copy of that mechanism here would
 * be two sources of the same proof. This module's strings were hand-verified byte-for-byte
 * against the design source with a throwaway extraction script before this file was written
 * (the same discipline F8's `blog/copy.ts` commit records), and F13 is the shipped, permanent
 * guard.
 * What is F10's job, not this file's: anything that needs a render (deep-link anchor resolution,
 * the vocabulary literal's resolved `font-family`, the on-this-page index).
 */
import { NOT_A_NUMBER } from '@/shared/copy/notANumber';
import { describe, expect, it } from 'vitest';
import { METHOD_COPY, type MethodBlock, type MethodSection } from './copy';

const EXPECTED_ORDER: ReadonlyArray<readonly [string, string]> = [
  ['two-data-speeds', 'Two data speeds — do not mix them'],
  ['dealer-structure', 'Dealer structure — walls, flip, GEX'],
  ['flip-vs-walls', 'Flip vs walls — different gamma bases'],
  ['score-and-tier', 'Score and tier'],
  ['advisory-reads', 'Advisory reads'],
  ['ai-read-and-grounding', 'AI read and grounding'],
  ['simulation', 'Simulation'],
  ['where-the-read-is-weak', 'Where the read is weak'],
  ['what-convexa-never-does', 'What Convexa never does'],
  ['vocabulary', 'Vocabulary'],
];

function section(id: string): MethodSection {
  const found = METHOD_COPY.sections.find((s) => s.id === id);
  if (!found) throw new Error(`no section with id "${id}"`);
  return found;
}

function proseBlocks(s: MethodSection): ReadonlyArray<Extract<MethodBlock, { kind: 'prose' }>> {
  return s.blocks.filter((b): b is Extract<MethodBlock, { kind: 'prose' }> => b.kind === 'prose');
}

function tableBlocks(s: MethodSection): ReadonlyArray<Extract<MethodBlock, { kind: 'table' }>> {
  return s.blocks.filter((b): b is Extract<MethodBlock, { kind: 'table' }> => b.kind === 'table');
}

const RETIRED_V1_FRAGMENTS = [
  'live tiles',
  'the tile says',
  'on the FE',
  'The ticker always labels',
  'The frontend maps them',
  'the ticker shows a single-name caveat',
  'about every few minutes',
  'evidence favors',
  'capped sum of plain components',
] as const;

describe('METHOD_COPY.sections — the ordered array (SPEC §2.6, PLAN D1, AC-M1)', () => {
  it('has exactly ten sections, in the design source’s order, each with a stable id', () => {
    expect(METHOD_COPY.sections).toHaveLength(10);
    expect(METHOD_COPY.sections.map((s) => [s.id, s.h])).toEqual(EXPECTED_ORDER.map((x) => [...x]));
  });

  it('every id is unique and every id + heading pair is non-empty', () => {
    const ids = METHOD_COPY.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of METHOD_COPY.sections) {
      expect(s.id.length).toBeGreaterThan(0);
      expect(s.h.length).toBeGreaterThan(0);
    }
  });

  it('every block is a well-formed member of the discriminated union (D1: union at block level)', () => {
    for (const s of METHOD_COPY.sections) {
      expect(s.blocks.length).toBeGreaterThan(0);
      for (const b of s.blocks) {
        if (b.kind === 'prose') {
          expect(b.body.length).toBeGreaterThan(0);
          for (const p of b.body) expect(p.length).toBeGreaterThan(0);
        } else if (b.kind === 'table') {
          expect(b.head.length).toBeGreaterThan(0);
          expect(b.rows.length).toBeGreaterThan(0);
          for (const row of b.rows) expect(row).toHaveLength(b.head.length);
        } else {
          throw new Error(`section "${s.id}" carries an unknown block kind`);
        }
      }
    }
  });

  it('score-and-tier and vocabulary are the only two sections carrying a table (D1’s stated reason)', () => {
    const withTable = METHOD_COPY.sections
      .filter((s) => tableBlocks(s).length > 0)
      .map((s) => s.id);
    expect(withTable).toEqual(['score-and-tier', 'vocabulary']);
  });
});

describe('Score table (SPEC §4; Max column pinned to the engine by PLAN F13, not re-checked here)', () => {
  it('carries the shipped head and exactly five rows in the design source’s order', () => {
    const [table] = tableBlocks(section('score-and-tier'));
    expect(table.head).toEqual(['Component', 'Max', 'What it reads']);
    expect(table.rows.map((r) => r[0])).toEqual([
      'Proximity to walls / flip',
      '|IV/HV − 1| stretch',
      'Active setups',
      'Flip transition',
      'Dark-pool confluence',
    ]);
    expect(table.rows.map((r) => r[1])).toEqual(['40', '25', '25', '10', '6']);
  });

  it('states the two-stage clamp, never the retired v1 "capped sum" clause (AC-M2a)', () => {
    const delta = proseBlocks(section('score-and-tier')).find((b) => !b.muted);
    const text = delta?.body.join(' ') ?? '';
    expect(text).toMatch(/capped twice/);
    expect(text).toMatch(/no score ever exceeds 100/);
    expect(text).not.toMatch(/capped sum of plain components/);
  });

  it('states the score’s honest scope — no vol-normalized GEX, no IV-rank band (AC-M3)', () => {
    const muted = proseBlocks(section('score-and-tier')).find((b) => b.muted);
    const text = muted?.body.join(' ') ?? '';
    expect(text).toMatch(/does not consume vol-normalized GEX/);
    expect(text).toMatch(/IV-rank band/);
  });
});

describe('Vocabulary table (AC-M4 — set-equality in both directions, SPEC §7 item 9)', () => {
  it('carries exactly the NOT_A_NUMBER members — none missing, none extra', () => {
    const [table] = tableBlocks(section('vocabulary'));
    const literalColumn = table.rows.map((r) => r[0]);
    expect(literalColumn).toHaveLength(NOT_A_NUMBER.length);
    expect(new Set(literalColumn)).toEqual(new Set(NOT_A_NUMBER));
  });

  it('gives every literal its own, non-interchangeable definition (no two rows share a definition)', () => {
    const [table] = tableBlocks(section('vocabulary'));
    const defs = table.rows.map((r) => r[1]);
    expect(new Set(defs).size).toBe(defs.length);
  });

  it('separates the three closest pairs: not recorded / not provided / unavailable', () => {
    const [table] = tableBlocks(section('vocabulary'));
    const byLiteral = Object.fromEntries(table.rows.map((r) => [r[0], r[1]]));
    expect(byLiteral['not recorded']).toMatch(/never held this fact/);
    expect(byLiteral['not provided']).toMatch(/the source withheld it/);
    expect(byLiteral['unavailable']).toMatch(/this cycle/);
  });

  it('carries no "this is a selection" disclaimer anywhere in the module (the inversion the rule forbids)', () => {
    expect(JSON.stringify(METHOD_COPY)).not.toMatch(/this is a selection/i);
  });
});

describe('The three quoted deltas land byte-exact (AC-C1)', () => {
  it('AI section gains the "no trade" sentence (canon rule 16, AC-M8)', () => {
    const text = proseBlocks(section('ai-read-and-grounding'))
      .filter((b) => !b.muted)
      .flatMap((b) => b.body)
      .join(' ');
    expect(text).toContain(
      'A "no trade" read is a complete, correct answer — not an error and not a failed request.',
    );
  });

  it('AI section itemises what leaves the machine and names both drawer labels byte-exact (AC-M5a)', () => {
    const text = proseBlocks(section('ai-read-and-grounding'))
      .filter((b) => b.muted)
      .flatMap((b) => b.body)
      .join(' ');
    expect(text).toContain('What’s sent to the AI'); // U+2019, ai-rec/copy.ts:21
    expect(text).toContain("View what's sent"); // U+0027, features/auth/copy.ts:210
    expect(text).not.toMatch(/https?:\/\/|\/whats-sent/); // text, never a route link (AC-M5)
  });

  it('names no persona, flows or operator screen (AC-M5b)', () => {
    const serialized = JSON.stringify(METHOD_COPY).toLowerCase();
    expect(serialized).not.toMatch(/persona screen|flows screen|operator screen/);
  });
});

describe('Retired v1 fragments do not survive the rewrite (AC-C1a’s negative half)', () => {
  it.each(RETIRED_V1_FRAGMENTS)('does not contain %j anywhere in the module', (fragment) => {
    expect(JSON.stringify(METHOD_COPY)).not.toContain(fragment);
  });
});

describe('Unchanged top-level literals (byte-identical to the design source; untouched by this rewrite)', () => {
  it('title, subhead, disclaimer and the three CTAs stay as they are', () => {
    expect(METHOD_COPY.title).toBe('How Convexa works');
    expect(METHOD_COPY.subhead).toBe(
      'What the numbers mean, how often they update, and where the read is weak. ' +
        'Not a pitch deck — the assumptions behind the desk.',
    );
    expect(METHOD_COPY.disclaimer).toBe(
      'Convexa is an analysis tool. Simulated positions are paper. A connected brokerage is ' +
        'read-only — Convexa never places, changes, or cancels an order. Not investment advice.',
    );
    expect(METHOD_COPY.ctaScanner).toBe('Open Scanner');
    expect(METHOD_COPY.ctaTicker).toBe('Open free Ticker');
    expect(METHOD_COPY.ctaBack).toBe('Back to home');
  });
});

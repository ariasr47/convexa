/**
 * bannedWords.scan.spec.ts — the source scan enforcing AC-10 (SB): no user-facing string in the ai-rec
 * module may contain a word that overclaims a check (`verified`/`confirmed`/…), the internal word
 * `grounding`, or a check glyph. Modeled on `broker/noNaming.scan.spec.ts`, including both self-checks
 * — a scan that cannot prove it BITES is not enforcement (`structural-over-prose-enforcement`).
 *
 * Scans STRING LITERALS ONLY (identifiers like `GroundingNote` / `figureClause` are machinery, not
 * copy — the internal word `grounding` is deliberately part of every symbol in this module, and that is
 * fine; it must never reach a QUOTED literal).
 */
import { describe, expect, it } from 'vitest';

const RAW: Record<string, string> = import.meta.glob('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const BANNED = [
  'verified',
  'confirmed',
  'validated',
  'approved',
  'safe',
  'trusted',
  'grounding',
  'hallucinated',
  'suspect',
  'invalid',
];
const GLYPHS = ['✓', '✔', '☑', 'CheckCircle', 'CheckIcon', 'DoneIcon'];

const appFiles = () => Object.keys(RAW).filter((p) => !p.includes('.spec.'));

/** Strip line and block comments (incl. JSDoc) BEFORE extracting literals — this module's own doc
 *  comments freely use backtick-quoted identifiers as markdown-style code formatting, which is prose
 *  ABOUT the code, never a rendered user-facing string. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

/** Attribute values that are test/DOM machinery, never rendered to a user — `data-testid`,
 *  `data-member`, `data-clause`, `data-verdict`, `aria-label` id plumbing. Excluded by requiring the
 *  literal not be immediately preceded by one of these attribute names. */
const MACHINERY_ATTR = /\b(?:data-testid|data-member|data-clause|data-verdict)\s*=\s*$/;

/** Extract quoted string-literal / template-literal content — never code outside quotes. Every
 *  literal in this module's SOURCE is single-line (multi-line copy is built with `+` concatenation,
 *  never a multi-line template), so the patterns deliberately exclude raw newlines — that is what
 *  keeps a stray apostrophe in a comment ("doesn't") or a JSX quote from pairing across lines into one
 *  giant false match. May over-extract adjacent same-line text but never UNDER-extracts a real
 *  literal, which is the safe direction for a scan whose job is to catch a banned word. */
function extractLiterals(rawSrc: string): string[] {
  const src = stripComments(rawSrc);
  const out: string[] = [];
  const patterns = [/'(?:[^'\\\n]|\\.)*'/g, /"(?:[^"\\\n]|\\.)*"/g, /`(?:[^`\\\n]|\\.)*`/g];
  for (const re of patterns) {
    for (const m of src.matchAll(re)) {
      const before = src.slice(Math.max(0, m.index - 32), m.index);
      if (MACHINERY_ATTR.test(before)) continue; // test-id plumbing, never rendered
      out.push(m[0]);
    }
  }
  return out;
}

/** Whole-word, case-insensitive — `invalidation_level` (a wire TOKEN, not prose) must stay exempt, but
 *  `invalid` as prose must not. */
function bannedWordHits(literal: string): string[] {
  return BANNED.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(literal));
}

function glyphHits(literal: string): string[] {
  return GLYPHS.filter((g) => literal.includes(g));
}

describe('ai-rec-grounding · banned-word / no-check-glyph source scan (AC-10, ship-blocking)', () => {
  it('anti-vacuity 1 — scans a REAL, non-empty file set, including the four load-bearing modules', () => {
    const files = appFiles();
    expect(files.length).toBeGreaterThanOrEqual(10);
    for (const must of [
      './copy.ts',
      './literals.ts',
      './GroundingNote.tsx',
      './FigureClause.tsx',
    ]) {
      expect(files, `${must} missing from the scan`).toContain(must);
    }
  });

  it('the rule — no extracted literal contains a BANNED word', () => {
    const offenders: string[] = [];
    for (const [path, src] of Object.entries(RAW)) {
      if (path.includes('.spec.')) continue;
      for (const lit of extractLiterals(src)) {
        const hits = bannedWordHits(lit);
        if (hits.length) offenders.push(`${path}: ${lit} (${hits.join(',')})`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the carve-out is explicit — `invalidation_level` as a TOKEN is exempt from the `invalid` rule', () => {
    // Whole-word matching means the substring "invalid" inside "invalidation_level" never fires.
    expect(bannedWordHits("'invalidation_level'")).toEqual([]);
    // But standalone prose use of the word DOES fire — proving the carve-out is narrow, not a hole.
    expect(bannedWordHits("'this figure is invalid'")).toContain('invalid');
  });

  it('all three PREFILL_WITHHELD members pass the scan — they are user-facing copy in this folder', () => {
    const three = [
      "Not pre-filled — this was the AI's own number.",
      "Not pre-filled — Convexa couldn't check this figure.",
      "Not pre-filled — this read wasn't checked against Convexa's numbers.",
    ];
    for (const s of three) {
      expect(bannedWordHits(s)).toEqual([]);
      expect(glyphHits(s)).toEqual([]);
    }
  });

  it('glyphs — no source under the folder contains any banned check glyph', () => {
    const offenders: string[] = [];
    for (const [path, src] of Object.entries(RAW)) {
      if (path.includes('.spec.')) continue;
      const hits = glyphHits(src);
      if (hits.length) offenders.push(`${path}: ${hits.join(',')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('anti-vacuity 2 (the mutation) — the extractor DOES fire on a poisoned literal', () => {
    const poison = "const X = 'This figure is verified ✓';";
    const literals = extractLiterals(poison);
    expect(literals.length).toBeGreaterThan(0);
    const bannedFound = literals.some((l) => bannedWordHits(l).length > 0);
    const glyphFound = literals.some((l) => glyphHits(l).length > 0);
    expect(bannedFound).toBe(true);
    expect(glyphFound).toBe(true);
  });
});

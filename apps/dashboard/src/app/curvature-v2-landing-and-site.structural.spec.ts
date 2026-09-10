/**
 * curvature-v2-landing-and-site — the provenance pins (PLAN.md F13; SPEC.md §7 items 10, 16, 17).
 *
 * Homed OUTSIDE `pages/**` — precedent `chain-archive-object-store.structural.spec.ts:50-63`,
 * which already walks to the workspace root and reads files outside `apps/dashboard` — because
 * two of the four arms read files a `pages/**`-scoped spec could not reach at all:
 *   - `design/src/screens/{methodology,landing,blog}.mjs`, read from disk (a READ, not a runtime
 *     import — the canon's "nothing in the app imports from `design/` at runtime" stands).
 *   - `libs/quant-engine/src/signals.rs`, also read from disk. Reading a frozen crate's source is
 *     not importing it, and the five score caps live in `libs/quant-engine`, not in the frozen
 *     `apps/api` — both stay at zero diff (INTERFACE_CONTRACT.md: NO_BACKEND_CHANGE).
 *
 * Four arms, each mutation-proved ([structural-over-prose-enforcement] — poison the thing the
 * rule forbids and the build must go red, non-vacuously; the closer's mutation-proof record wants
 * exactly these four: one changed word, one restored retired fragment, one moved constant, each of
 * the three cut phrases pasted back):
 *   Arm A  — copy fidelity to the design source, positive half (AC-C1a, §7 item 16).
 *   Arm A′ — the retired v1 fragments never survive under pages/methodology/** (negative half —
 *            "and it is the half that bites").
 *   Arm B  — the score table's five caps, pinned to signals.rs, two-stage clamp (AC-M2, §7 item 10).
 *   Arm C  — the hero panel's three cut phrases stay cut from pages/landing/** source, source half
 *            (§7 item 17 — the rendered half is F7's landing-structure.spec.tsx; the spec-file
 *            exclusion below is what keeps THAT file's own cut-phrase array from red-building
 *            this arm — do not drop it).
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { BLOG_ARTICLES } from '@/pages/blog/BlogPage';
import { BLOG_COPY } from '@/pages/blog/copy';
import { LANDING_COPY } from '@/pages/landing/copy';
import { METHOD_COPY, type MethodBlock } from '@/pages/methodology/copy';

function workspaceRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'nx.json'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('nx workspace root not found from ' + process.cwd());
}
const ROOT = workspaceRoot();

const METHODOLOGY_MJS_PATH = resolve(ROOT, 'design', 'src', 'screens', 'methodology.mjs');
const LANDING_MJS_PATH = resolve(ROOT, 'design', 'src', 'screens', 'landing.mjs');
const BLOG_MJS_PATH = resolve(ROOT, 'design', 'src', 'screens', 'blog.mjs');
const SIGNALS_RS_PATH = resolve(ROOT, 'libs', 'quant-engine', 'src', 'signals.rs');

const METHODOLOGY_MJS = readFileSync(METHODOLOGY_MJS_PATH, 'utf8');
const LANDING_MJS = readFileSync(LANDING_MJS_PATH, 'utf8');
const BLOG_MJS = readFileSync(BLOG_MJS_PATH, 'utf8');
const SIGNALS_RS = readFileSync(SIGNALS_RS_PATH, 'utf8');
const SIGNALS_LINES = SIGNALS_RS.split('\n');

// ---------------------------------------------------------------------------
// Pure checkers — each proven non-vacuous below, per [structural-over-prose-enforcement].
// ---------------------------------------------------------------------------

/** Which of `needles` are NOT found verbatim in `haystack`. Empty result = full presence. */
function missingFrom(haystack: string, needles: readonly string[]): string[] {
  return needles.filter((n) => !haystack.includes(n));
}

/** Which of `needles` ARE found verbatim in `haystack` (forbidden). Empty result = all clear. */
function presentIn(haystack: string, needles: readonly string[]): string[] {
  return needles.filter((n) => haystack.includes(n));
}

/** 1-indexed line `lineNo` of `src` contains `needle`. */
function lineContains(src: string, lineNo: number, needle: string): boolean {
  const lines = src.split('\n');
  return (lines[lineNo - 1] ?? '').includes(needle);
}

/**
 * Strips `/* ... *\/` block comments (non-greedy, multi-line) before a forbidden-phrase scan, so a
 * doc comment CITING a cut phrase — e.g. `pages/landing/copy.ts`'s own header, which quotes all
 * three phrases verbatim to explain why they are cut — does not itself red-build Arm C. This is a
 * pragmatic, non-tokenizing stripper (adequate for the small, known `pages/landing/**` surface it
 * runs against, not a general JS/TS parser); line comments are left alone because none of the three
 * phrases occurs in one anywhere in this folder today (verified before this file was written) and
 * blanket-stripping `//` risks eating a URL. A phrase pasted into REAL code (JSX text, a copy
 * string — anything outside `/* *\/`) is still caught, proven by the MUTATION GUARD below.
 */
function stripBlockComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('Pure checkers are not vacuous (MUTATION GUARD)', () => {
  it('missingFrom flags an absent needle and clears once it is present', () => {
    expect(missingFrom('hello world', ['hello', 'planet'])).toEqual(['planet']);
    expect(missingFrom('hello world', ['hello', 'world'])).toEqual([]);
  });

  it('presentIn flags a forbidden needle and clears once it is gone', () => {
    expect(presentIn('rendered from the desk’s own bundle', ['own bundle'])).toEqual([
      'own bundle',
    ]);
    expect(presentIn('rendered from the desk’s own model', ['own bundle'])).toEqual([]);
  });

  it('lineContains is sensitive to a constant moving off its pinned line', () => {
    const original = 'const A = 1;\nconst CAP: i32 = 6;\nconst C = 3;';
    expect(lineContains(original, 2, 'CAP: i32 = 6')).toBe(true);
    const moved = 'const A = 1;\nconst X = 0;\nconst CAP: i32 = 6;';
    expect(lineContains(moved, 2, 'CAP: i32 = 6')).toBe(false);
    expect(lineContains(moved, 3, 'CAP: i32 = 6')).toBe(true);
  });

  it('stripBlockComments hides a phrase quoted in a doc comment, but not one pasted into real code', () => {
    const commented = '/** cut: three.js surface, never shipped */\nexport const x = 1;';
    expect(presentIn(stripBlockComments(commented), ['three.js'])).toEqual([]);
    const real = '/** ok */\nconst caption = "three.js surface";';
    expect(presentIn(stripBlockComments(real), ['three.js'])).toEqual(['three.js']);
  });
});

// ---------------------------------------------------------------------------
// Arm A — copy fidelity to the design source, positive half (AC-C1a, §7 item 16)
// ---------------------------------------------------------------------------

describe('Arm A · copy fidelity to design/src/screens/methodology.mjs (AC-C1a, §7 item 16)', () => {
  const isDelta = (s: string): boolean =>
    s.includes('capped twice') || // delta 1 — score section's corrected intro clause (AC-M2a)
    s.includes('A "no trade" read is a complete, correct answer') || // delta 2 — canon rule 16
    s.startsWith('What leaves the machine, on demand'); // delta 3 — the reviewable-payload sentence

  function allProse(): string[] {
    return METHOD_COPY.sections.flatMap((s) =>
      s.blocks
        .filter((b): b is Extract<MethodBlock, { kind: 'prose' }> => b.kind === 'prose')
        .flatMap((b) => b.body),
    );
  }

  it('anti-vacuity — ten headings and seventeen paragraphs, three of which are the named deltas', () => {
    expect(METHOD_COPY.sections).toHaveLength(10);
    const prose = allProse();
    expect(prose).toHaveLength(17);
    expect(prose.filter(isDelta)).toHaveLength(3);
    expect(prose.filter((s) => !isDelta(s))).toHaveLength(14);
  });

  it('every one of the ten headings is present byte-for-byte in the design source', () => {
    const headings = METHOD_COPY.sections.map((s) => s.h);
    expect(missingFrom(METHODOLOGY_MJS, headings)).toEqual([]);
  });

  it('every paragraph except the three named deltas is present byte-for-byte', () => {
    const kept = allProse().filter((s) => !isDelta(s));
    expect(missingFrom(METHODOLOGY_MJS, kept)).toEqual([]);
  });

  it('negative control — the three excluded deltas are NOT verbatim upstream (the exclusion is real, not a loophole)', () => {
    const deltas = allProse().filter(isDelta);
    expect(deltas).toHaveLength(3);
    expect(missingFrom(METHODOLOGY_MJS, deltas)).toEqual(deltas);
  });
});

describe('Arm A · copy fidelity to design/src/screens/landing.mjs (AC-C1a, §7 item 16)', () => {
  const isAmendedFieldBullet = (s: string): boolean =>
    s.startsWith('On a ticker desk the mid is tape');

  it('the three feature bodies are present byte-for-byte', () => {
    const bodies = [LANDING_COPY.field.body, LANDING_COPY.score.body, LANDING_COPY.aiRead.body];
    expect(bodies).toHaveLength(3);
    expect(missingFrom(LANDING_MJS, bodies)).toEqual([]);
  });

  it('eight of the nine bullets are present byte-for-byte; the ninth is the named amendment', () => {
    const bullets = [
      ...LANDING_COPY.field.bullets,
      ...LANDING_COPY.score.bullets,
      ...LANDING_COPY.aiRead.bullets,
    ];
    expect(bullets).toHaveLength(9);
    const amended = bullets.filter(isAmendedFieldBullet);
    const kept = bullets.filter((b) => !isAmendedFieldBullet(b));
    expect(amended).toHaveLength(1);
    expect(kept).toHaveLength(8);
    expect(missingFrom(LANDING_MJS, kept)).toEqual([]);
  });

  it('negative control — the amended bullet’s four added words are NOT verbatim upstream', () => {
    const amended = [
      ...LANDING_COPY.field.bullets,
      ...LANDING_COPY.score.bullets,
      ...LANDING_COPY.aiRead.bullets,
    ].filter(isAmendedFieldBullet);
    expect(amended).toHaveLength(1);
    expect(LANDING_MJS.includes(amended[0])).toBe(false);
  });

  it('the three trust-card bodies are present byte-for-byte', () => {
    const cardBodies = LANDING_COPY.register.trustCards.map((c) => c.body);
    expect(cardBodies).toHaveLength(3);
    expect(missingFrom(LANDING_MJS, cardBodies)).toEqual([]);
  });
});

describe('Arm A · copy fidelity to design/src/screens/blog.mjs (AC-C1a, §7 item 16)', () => {
  it('the eyebrow, heading, intro and the one published card dek are present byte-for-byte', () => {
    expect(BLOG_ARTICLES).toHaveLength(1);
    const needles = [
      BLOG_COPY.eyebrow,
      BLOG_COPY.heading,
      BLOG_COPY.intro,
      BLOG_ARTICLES[0].description,
    ];
    expect(missingFrom(BLOG_MJS, needles)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Arm A′ — the negative half, and it is the half that bites (AC-C1a)
// ---------------------------------------------------------------------------

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

const METHODOLOGY_SOURCES = import.meta.glob(
  ['/src/app/pages/methodology/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}', '!**/*.test.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

describe('Arm A′ · retired v1 fragments never survive under pages/methodology/** (AC-C1a, negative half)', () => {
  it('anti-vacuity — the glob sees copy.ts and MethodologyPage.tsx, and excludes every spec file', () => {
    const keys = Object.keys(METHODOLOGY_SOURCES);
    expect(keys.length).toBeGreaterThanOrEqual(2);
    expect(keys.some((k) => k.endsWith('/copy.ts'))).toBe(true);
    expect(keys.some((k) => k.endsWith('/MethodologyPage.tsx'))).toBe(true);
    expect(keys.some((k) => k.includes('.spec.'))).toBe(false);
  });

  it('no shipped methodology source carries any of the nine retired v1 fragments', () => {
    const offenders: string[] = [];
    for (const [path, src] of Object.entries(METHODOLOGY_SOURCES)) {
      const hits = presentIn(src, RETIRED_V1_FRAGMENTS);
      if (hits.length) offenders.push(`${path} → ${hits.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Arm B — engine constants: the score table's five caps (AC-M2, §7 item 10)
// ---------------------------------------------------------------------------

describe("Arm B · the score table's five caps are pinned to libs/quant-engine/src/signals.rs (AC-M2, §7 item 10)", () => {
  it('anti-vacuity — the file exists and is substantial', () => {
    expect(existsSync(SIGNALS_RS_PATH)).toBe(true);
    expect(SIGNALS_RS.length).toBeGreaterThan(1000);
  });

  it('DARK_POOL_BONUS_CAP: i32 = 6 at :24, applied at :541', () => {
    expect(lineContains(SIGNALS_RS, 24, 'DARK_POOL_BONUS_CAP: i32 = 6')).toBe(true);
    expect(lineContains(SIGNALS_RS, 541, 'DARK_POOL_BONUS_CAP')).toBe(true);
  });

  it('proximity cap 40 at :482, vol-stretch cap 25 at :487, active-setups cap 25 at :488, flip-transition 10 at :489', () => {
    expect(lineContains(SIGNALS_RS, 482, '40.0')).toBe(true);
    expect(lineContains(SIGNALS_RS, 487, '.min(25.0)')).toBe(true);
    expect(lineContains(SIGNALS_RS, 488, '.min(25.0)')).toBe(true);
    expect(lineContains(SIGNALS_RS, 489, '10.0')).toBe(true);
  });

  it('the score table’s Max column matches 40 / 25 / 25 / 10 / 6, in the design source’s row order', () => {
    const [table] = METHOD_COPY.sections
      .find((s) => s.id === 'score-and-tier')!
      .blocks.filter((b): b is Extract<MethodBlock, { kind: 'table' }> => b.kind === 'table');
    expect(table.rows.map((r) => r[1])).toEqual(['40', '25', '25', '10', '6']);
  });

  it('the first-stage clamp is real: :490 caps exactly the four base components at 100.0, returning dark_pool: 0', () => {
    expect(lineContains(SIGNALS_RS, 490, '(proximity + vol + setup + transition).min(100.0)')).toBe(
      true,
    );
    expect(lineContains(SIGNALS_RS, 497, 'dark_pool: 0,')).toBe(true);
  });

  it('the dark-pool bonus is applied strictly AFTER that cap — :454 calls opportunity_score_parts, :458 then adds dp_bonus and caps again at 100', () => {
    expect(lineContains(SIGNALS_RS, 454, 'opportunity_score_parts(')).toBe(true);
    expect(lineContains(SIGNALS_RS, 458, '(drivers.total + dp_bonus).min(100)')).toBe(true);
    // Both statements live in the SAME function (generate_signals) — no `fn` boundary between
    // them — so their line order IS their execution order here, unlike FUNCTION-DEFINITION
    // order across the file (opportunity_score_parts is defined at :467, textually AFTER its
    // call site at :454, which Rust permits — this is why the proof does not compare :454/:458
    // against :490 directly: :490 sits inside a function called by, not textually before, :454).
    const between = SIGNALS_LINES.slice(454, 458); // 1-indexed lines 455..458, exclusive of both
    expect(between.some((l) => /^\s*(pub )?fn /.test(l))).toBe(false);
  });

  it('MUTATION GUARD: a phrase-only scan would vacuously pass even if the cap moved off its pinned line; the line-pinned checker does not', () => {
    const lines = SIGNALS_RS.split('\n');
    const moved = [...lines];
    // Swap line 24 (the constant) with its neighbour — the substring survives in the file as a
    // whole (a naive `.includes()` scan would wrongly still pass), but it is no longer AT line 24.
    [moved[23], moved[24]] = [moved[24], moved[23]];
    const poisonedSrc = moved.join('\n');
    expect(poisonedSrc.includes('DARK_POOL_BONUS_CAP: i32 = 6')).toBe(true); // still IN the file …
    expect(lineContains(poisonedSrc, 24, 'DARK_POOL_BONUS_CAP: i32 = 6')).toBe(false); // … not at :24
  });
});

// ---------------------------------------------------------------------------
// Arm C — the hero panel's three cut phrases stay cut, source half (§7 item 17)
// ---------------------------------------------------------------------------

const CUT_PHRASES = ['three.js', '7d → 90d', 'own bundle'] as const;

const LANDING_SOURCES_NO_SPEC = import.meta.glob(
  ['/src/app/pages/landing/**/*.{ts,tsx}', '!**/*.spec.*'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

describe('Arm C · the hero panel’s three cut phrases stay cut from pages/landing/** source (§7 item 17)', () => {
  it('anti-vacuity — the glob is not empty and excludes every spec file', () => {
    const keys = Object.keys(LANDING_SOURCES_NO_SPEC);
    expect(keys.length).toBeGreaterThanOrEqual(6);
    expect(keys.some((k) => k.includes('.spec.'))).toBe(false);
  });

  it('MUTATION GUARD: the apostrophe-free fragments bite regardless of U+2019 vs U+0027', () => {
    expect(presentIn('7d → 90d tenors', CUT_PHRASES)).toEqual(['7d → 90d']);
    expect(presentIn("rendered from the desk's own bundle", CUT_PHRASES)).toEqual(['own bundle']);
    expect(presentIn('rendered from the desk’s own bundle', CUT_PHRASES)).toEqual(['own bundle']);
    expect(presentIn('the desk’s own model, drawn in depth', CUT_PHRASES)).toEqual([]);
  });

  it('no non-spec source under pages/landing/** carries three.js, 7d → 90d, or own bundle, once doc-comment citations are stripped', () => {
    const offenders: string[] = [];
    for (const [path, src] of Object.entries(LANDING_SOURCES_NO_SPEC)) {
      const hits = presentIn(stripBlockComments(src), CUT_PHRASES);
      if (hits.length) offenders.push(`${path} → ${hits.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });
});

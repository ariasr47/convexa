/**
 * LAYER 2 of the no-naming machinery (SPEC §2.3) — the SOURCE scan. Copied from
 * `unrenderedBrokerPl.spec.tsx:133-164` INCLUDING both self-checks, because a scan that cannot prove
 * it bit is not enforcement.
 */
import { describe, expect, it } from 'vitest';
import { AC4_WORDS, B2_TERMS, b1HitsIn, b2HitsIn } from '../../../../testing/noNamingVocabulary';

/**
 * RECURSIVE, unlike the shipped single-level pattern: a module placed in a subdirectory
 * (`broker/group/helpers.ts`) would otherwise be invisible here while Layer 1's file-named overrides
 * missed it too, so nothing would carry it. `broker/` is flat today, so this returns the identical set
 * now and costs nothing — it only removes a future blind spot.
 */
const RAW_SOURCES = import.meta.glob('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/**
 * The twelve non-spec modules that shipped BEFORE this feature. Defining the set by EXCLUSION rather
 * than by an include list means every NEW module under `broker/` is scanned by default — including one
 * a later session adds without reading the spec.
 */
const EXEMPT = [
  './brokerView.ts',
  './copy.ts',
  './fixtures.ts',
  './BrokerPositionRow.tsx',
  './BrokerPositionCard.tsx',
  './reassess.tsx',
  './BrokerTabPanel.tsx',
  './ProvenanceHeader.tsx',
  './predicates.ts',
  './renderState.ts',
  './useBrokerBook.ts',
  './useBrokerMarks.ts',
];

const appFiles = () => Object.keys(RAW_SOURCES).filter((p) => !p.includes('.spec.'));
const scanned = () =>
  Object.entries(RAW_SOURCES).filter(([p]) => !p.includes('.spec.') && !EXEMPT.includes(p));

/** Predicate set A — the naming MACHINE. */
const SET_A: readonly RegExp[] = [
  /from\s+['"][^'"]*positions\/(structure|view|leg)['"]/,
  /\bSimPosition\b/,
  /\bbuildPositionView\b/,
  /\bstructureKindOf\b/,
  /\bStructureKind\b/,
  /\bSTRUCTURE_LABELS\b/,
  /\bplPctStateOf\b/,
  /\bNET_BASIS_EPS\b/,
];

describe('Layer 2 · anti-vacuity — the scan is looking at something real', () => {
  it('scans a REAL, non-empty file set', () => {
    expect(appFiles().length).toBeGreaterThanOrEqual(10);
  });

  it('every EXEMPT path still exists in the glob (a rename turns this red, not silently green)', () => {
    for (const p of EXEMPT) expect(appFiles(), `${p} vanished`).toContain(p);
  });

  it('the scanned remainder contains all three files this feature authors', () => {
    const paths = scanned().map(([p]) => p);
    expect(paths).toContain('./grouping.ts');
    expect(paths).toContain('./BrokerGroupHeader.tsx');
    expect(paths).toContain('./groupCopy.ts');
  });
});

describe('Layer 2 · the scan', () => {
  it('set A — no scanned module reaches the naming machine', () => {
    const offenders = scanned()
      .filter(([, src]) => SET_A.some((re) => re.test(src)))
      .map(([p]) => p);
    expect(offenders).toEqual([]);
  });

  it('B1 — no scanned module contains a whole STRUCTURE_LABELS value as typed text', () => {
    for (const [p, src] of scanned()) expect(b1HitsIn(src), p).toEqual([]);
  });

  it('B2 — no scanned module contains a bare shape word as typed text', () => {
    for (const [p, src] of scanned()) expect(b2HitsIn(src), p).toEqual([]);
  });

  it('no scanned module imports the TEST vocabulary (it holds every banned word by design)', () => {
    const offenders = scanned()
      .filter(([, src]) => /testing\/noNamingVocabulary/.test(src))
      .map(([p]) => p);
    expect(offenders).toEqual([]);
  });
});

describe('Layer 2 · MUTATION GUARDS — one per predicate, or the predicate is unproven', () => {
  it('1. set A fires on a real reference', () => {
    expect(SET_A.some((re) => re.test('const p: SimPosition = x;'))).toBe(true);
  });

  it('2. B1 fires on a hand-typed compound label', () => {
    expect(b1HitsIn("const t = 'Call debit spread';").length).toBeGreaterThan(0);
  });

  it('3. B2 catches what NO pre-existing predicate could — and B1 stays silent on it', () => {
    const poison = "const t = 'these legs may form a spread';";
    expect(b2HitsIn(poison).length).toBeGreaterThan(0);
    expect(b1HitsIn(poison)).toEqual([]); // the whole point: a new arm, not B1 under a new name
    expect(SET_A.some((re) => re.test(poison))).toBe(false);
  });

  it('4. the allow-pattern exempts the OCCURRENCE, not the word', () => {
    expect(b2HitsIn('<Divider orientation="vertical" />')).toEqual([]);
    expect(b2HitsIn('// lay the legs out as a vertical').length).toBeGreaterThan(0);
  });

  it('ANTI-DRIFT — every one of AC-4’s eight words is matched by at least one B2 term', () => {
    for (const w of AC4_WORDS) {
      expect(
        B2_TERMS.some((re) => re.test(w)),
        w,
      ).toBe(true);
    }
  });
});

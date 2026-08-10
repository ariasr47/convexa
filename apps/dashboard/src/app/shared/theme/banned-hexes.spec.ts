/**
 * redesign-stage-1 §8-1 — the RETIRED identity is structurally unreachable (convexa-design
 * banned-tells, enforced as code): GitHub Dark's neutrals, the retired brand blues, the violet,
 * the blog cream, and the outgoing canvas can never re-enter the app.
 *
 * Scope (wider than `hex-discipline.spec.ts`, which excludes `shared/theme` by construction):
 * ALL of `src/app/**` INCLUDING `shared/theme` (tokens.ts must not quietly re-grow a retired
 * value), the static `/index.html`, and the GENERATED blog output under `public/blog/`.
 * Zero exemptions — a hit here is a FAIL, never an allowlist entry.
 *
 * The ban list is SPLIT-CONSTRUCTED (bare hex bodies + a joined '#') so this spec's own source
 * can never self-flag, and spec files are excluded from the glob anyway. Case-insensitive.
 * MUTATION-GUARDED: the checker is proven to fail on a fixture carrying a banned hex.
 */
import { describe, expect, it } from 'vitest';

// Root-anchored raw GLOB (not a static import — keeps @nx/enforce-module-boundaries happy).
const INDEX_RAW = import.meta.glob(['/index.html'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const indexHtml = Object.values(INDEX_RAW)[0] ?? '';

const APP_SOURCES = import.meta.glob(['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const BLOG_PAGES = import.meta.glob(['/public/blog/*.html'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Retired hexes, held headless so the list itself is not a hex literal. */
const RETIRED = [
  '4f9cff', // retired brand blue (dark primary)
  '1d6fe0', // retired brand blue (light primary / buttonPrimaryBg)
  '7b5cff', // accentViolet — violet retired ENTIRELY
  '0d1117', // GitHub Dark canvas
  '161b22', // GitHub Dark surface (old paper)
  '8b949e', // GitHub Dark secondary text
  'e6edf3', // GitHub Dark primary text
  'f4f1eb', // the blog cream — the literal slop-tell
  '0e1117', // the outgoing canvas
  // redesign-stage-3 §8-9a — the blog ILLUSTRATION cream family (the card-on-dark collision the
  // stage-3 artwork recomposition removed; app sources AND blog output can never re-grow them):
  'faf8f4', // illustration canvas cream
  'e7e2d8', // illustration cream border
  'f3e3d9', // illustration terracotta-tint card
  'f6eedd', // illustration amber-tint chip
];
const BANNED = RETIRED.map((h) => `#${h}`);

/** Pure checker (mutation-tested below): banned hexes present in a text, case-insensitive. */
function findBanned(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED.filter((h) => lower.includes(h));
}

describe('[banned-hexes] · the retired identity is unreachable', () => {
  it('the globs are not vacuous (sources + blog output actually loaded)', () => {
    expect(Object.keys(APP_SOURCES).length).toBeGreaterThan(40);
    expect(Object.keys(APP_SOURCES).some((k) => k.includes('/shared/theme/'))).toBe(true);
    expect(Object.keys(BLOG_PAGES).length).toBeGreaterThanOrEqual(1);
    expect(indexHtml.length).toBeGreaterThan(100);
  });

  it('MUTATION GUARD: the checker fails on a source carrying a banned hex (upper AND lower case)', () => {
    expect(findBanned(`const c = '#4f9cff';`)).toEqual([`#${RETIRED[0]}`]);
    expect(findBanned(`background: #F4F1EB;`)).toEqual([`#${RETIRED[7]}`]);
    expect(findBanned(`<rect fill="#FAF8F4"/>`)).toEqual([`#${RETIRED[9]}`]); // the cream family
    expect(findBanned(`stroke="#f3e3d9"`)).toEqual([`#${RETIRED[11]}`]);
    expect(findBanned(`const fine = '#F2A93B';`)).toEqual([]);
  });

  it('no app source (INCLUDING shared/theme) carries a retired hex', () => {
    const violations: string[] = [];
    for (const [file, src] of Object.entries(APP_SOURCES)) {
      for (const hit of findBanned(src)) violations.push(`${file} → ${hit}`);
    }
    expect(violations).toEqual([]);
  });

  it('index.html carries no retired hex (the first-paint theme-color moved to ink)', () => {
    expect(findBanned(indexHtml)).toEqual([]);
  });

  it('the generated blog output carries no retired hex (cream especially)', () => {
    const violations: string[] = [];
    for (const [file, src] of Object.entries(BLOG_PAGES)) {
      for (const hit of findBanned(src)) violations.push(`${file} → ${hit}`);
    }
    expect(violations).toEqual([]);
  });
});

/**
 * AC-44 — this phase introduces zero new hardcoded colour literals, HEX OR `rgba()`.
 * `hex-discipline.spec.ts` cannot see an rgba token, so this scan is seeded FROM `tokens.ts`
 * ITSELF: import the values, normalise whitespace, and assert none of those exact strings appears
 * in any component source outside `shared/theme`. Self-maintaining — a new token is covered the
 * day it lands — and mutation-tested.
 */
import { describe, expect, it } from 'vitest';
import { extras, extrasLight, palette } from './tokens';

const SOURCES = import.meta.glob(
  [
    '/src/app/pages/**/*.{ts,tsx}',
    '/src/app/features/**/*.{ts,tsx}',
    '/src/app/shell/**/*.{ts,tsx}',
    '/src/app/shared/**/*.{ts,tsx}',
    '!/src/app/shared/theme/**', // where colour BELONGS
    '!**/*.spec.{ts,tsx}',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const appPath = (k: string) => k.replace(/^\/src\/app\//, '');
const squash = (s: string) => s.replace(/\s+/g, '');

/** The seven v2 additions, both schemes — the exact strings no component may carry. */
const BANNED = [
  palette.dark.divider,
  palette.light.divider,
  ...(
    [
      'well',
      'panelRaised2',
      'lineStrong',
      'textTertiary',
      'scrim',
      'glass',
      'textDim',
      'textInfo',
    ] as const
  ).flatMap((k) => [extras[k], extrasLight[k]]),
].map(squash);

/**
 * EXEMPT — each entry a real, pre-existing, NON-token use of a string that happens to equal a
 * token value, with its one-line reason. Stale-entry-checked below.
 */
const EXEMPT: Record<string, string> = {
  'shared/ui/Widget/Widget.tsx':
    'inset well shadow `inset 0 2px 10px -5px rgba(0,0,0,0.55)` — a neutral depth alpha that predates `scrim` and is not an overlay dim (Widget.tsx:137, dark arm only)',
};

/**
 * Pure checker (drives the mutation guard). `exempt` defaults to the module `EXEMPT` map so the
 * two enforcement tests skip known-good files; the liveness self-check below passes `{}` instead
 * (mirroring `spacing-ladder.spec.ts`'s `offLadder(..., [])`) so it proves the exempted file still
 * ACTUALLY carries the literal rather than trivially skipping it.
 */
function bannedHits(
  files: Record<string, string>,
  banned: string[],
  exempt: Record<string, string> = EXEMPT,
): string[] {
  const out: string[] = [];
  for (const [key, src] of Object.entries(files)) {
    const file = appPath(key);
    if (file in exempt) continue;
    const flat = squash(src);
    for (const b of banned) if (flat.includes(b)) out.push(`${file} → ${b}`);
  }
  return out;
}

describe('banned-literals — no component carries a v2 token value verbatim', () => {
  it('the ban list and the glob are both non-empty (anti-vacuity)', () => {
    expect(BANNED.length).toBe(18);
    expect(Object.keys(SOURCES).length).toBeGreaterThan(40);
    expect(
      Object.keys(SOURCES)
        .map(appPath)
        .some((k) => k.startsWith('pages/')),
    ).toBe(true);
    expect(
      Object.keys(SOURCES)
        .map(appPath)
        .some((k) => k.startsWith('shell/')),
    ).toBe(true);
    expect(
      Object.keys(SOURCES)
        .map(appPath)
        .every((k) => !k.startsWith('shared/theme/')),
    ).toBe(true);
  });

  it('MUTATION GUARD: a planted token literal is caught, a clean source is not', () => {
    expect(
      bannedHits({ '/src/app/pages/x.tsx': `sx={{ bgcolor: '${extras.glass}' }}` }, BANNED),
    ).toHaveLength(1);
    expect(
      bannedHits({ '/src/app/pages/x.tsx': `sx={{ bgcolor: 'background.paper' }}` }, BANNED),
    ).toHaveLength(0);
  });

  it('no component source outside shared/theme carries a v2 token value', () => {
    const hits = bannedHits(SOURCES, BANNED);
    expect(hits, `bind the token, do not paste its value:\n${hits.join('\n')}`).toEqual([]);
  });

  it('the EXEMPT list is LIVE — a listed file must still exist and still hit', () => {
    for (const file of Object.keys(EXEMPT)) {
      const entry = Object.entries(SOURCES).find(([k]) => appPath(k) === file);
      if (!entry) throw new Error(`${file} exempted but missing — remove the entry`);
      expect(
        bannedHits({ [`/src/app/${file}`]: entry[1] }, BANNED, {}).length,
        `${file} exempted but carries no banned literal anymore — remove the entry`,
      ).toBeGreaterThan(0);
    }
  });
});

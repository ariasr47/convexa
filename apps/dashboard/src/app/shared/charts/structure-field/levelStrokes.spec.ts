/**
 * `levelStrokes.ts` — the ONE stroke table (SPEC §2.7, canon 14, criteria 7 / 52 / 53).
 *
 * FE-3 SCOPE NOTE: criterion 7's full teeth ("a scan of StructureFieldCanvas.tsx AND the ladder
 * module finds zero hex literals … and the ladder's tick colours are read from the same
 * LevelPalette object the canvas receives") needs a ladder component that does not exist yet — the
 * level ladder is FE-5 (PLAN.md, depends on FE-3). This spec proves everything FE-3 CAN prove now:
 * the table's completeness, the resolver's scheme-awareness, the resolver's fidelity to
 * `LEVEL_STROKES` (mutation-guarded), and the canvas half of the hex-literal scan. The identity
 * check against the ladder's tick is `LevelLadder.spec.tsx`'s job at FE-5 — see
 * `StructureFieldCanvas.spec.tsx`'s companion describe block for the canvas half of criterion 7.
 */
import { lightTheme, theme } from '@/shared/theme/theme';
import { describe, expect, it } from 'vitest';
import { LEVEL_STROKES, resolveLevelPalette, withAlpha, type LadderRowId } from './levelStrokes';

const ALL_ROW_IDS: LadderRowId[] = ['callWall', 'mid', 'maxPain', 'gammaFlip', 'putWall'];

describe('LEVEL_STROKES — the one table', () => {
  it('carries exactly the five ladder rows, no more, no fewer', () => {
    const keys = Object.keys(LEVEL_STROKES).sort();
    expect(keys).toEqual([...ALL_ROW_IDS].sort());
  });

  it('every entry is a recognized token key (compile-enforced by the Record type; asserted here for the reader)', () => {
    const validKeys = new Set([
      'palette.success.main',
      'palette.error.main',
      'palette.text.secondary',
      'palette.primary.main',
      'palette.info.main',
    ]);
    for (const id of ALL_ROW_IDS) {
      expect(validKeys.has(LEVEL_STROKES[id])).toBe(true);
    }
  });
});

describe('resolveLevelPalette — the only place a token key becomes a colour', () => {
  it('returns five non-empty strings for the dark theme', () => {
    const resolved = resolveLevelPalette(theme);
    for (const id of ALL_ROW_IDS) {
      expect(typeof resolved[id]).toBe('string');
      expect(resolved[id].length).toBeGreaterThan(0);
    }
  });

  it('returns five non-empty strings for the light theme', () => {
    const resolved = resolveLevelPalette(lightTheme);
    for (const id of ALL_ROW_IDS) {
      expect(typeof resolved[id]).toBe('string');
      expect(resolved[id].length).toBeGreaterThan(0);
    }
  });

  it('differs in at least one member between schemes (criterion 53\'s structural half — no scheme-invariant stroke)', () => {
    const dark = resolveLevelPalette(theme);
    const light = resolveLevelPalette(lightTheme);
    const differing = ALL_ROW_IDS.filter((id) => dark[id] !== light[id]);
    expect(differing.length).toBeGreaterThan(0);
  });

  it('resolves each row to the exact theme value its token key names', () => {
    expect(resolveLevelPalette(theme).callWall).toBe(theme.palette.success.main);
    expect(resolveLevelPalette(theme).putWall).toBe(theme.palette.error.main);
    expect(resolveLevelPalette(theme).maxPain).toBe(theme.palette.text.secondary);
    expect(resolveLevelPalette(theme).gammaFlip).toBe(theme.palette.primary.main);
    expect(resolveLevelPalette(theme).mid).toBe(theme.palette.info.main);
  });

  it('MUTATION GUARD: changing one key in LEVEL_STROKES moves only that resolved entry', () => {
    const mutable = LEVEL_STROKES as Record<LadderRowId, (typeof LEVEL_STROKES)[LadderRowId]>;
    const original = mutable.mid;
    expect(original).toBe('palette.info.main'); // sanity — we know what we're about to poison
    try {
      mutable.mid = 'palette.error.main';
      const resolved = resolveLevelPalette(theme);
      // Poisoned: mid now reads the error-red token, not the signal-blue one.
      expect(resolved.mid).toBe(theme.palette.error.main);
      expect(resolved.mid).not.toBe(theme.palette.info.main);
      // Everything else is untouched by the poison.
      expect(resolved.callWall).toBe(theme.palette.success.main);
      expect(resolved.putWall).toBe(theme.palette.error.main);
      expect(resolved.gammaFlip).toBe(theme.palette.primary.main);
      expect(resolved.maxPain).toBe(theme.palette.text.secondary);
    } finally {
      mutable.mid = original;
    }
    // Revert proven: back to the real mapping.
    expect(resolveLevelPalette(theme).mid).toBe(theme.palette.info.main);
  });
});

describe('withAlpha — derived alpha from a RESOLVED colour, never a fresh literal', () => {
  it('produces an rgba() string carrying the requested opacity, from a hex input', () => {
    const out = withAlpha('#2ecc71', 0.25);
    expect(out).toMatch(/^rgba\(46, 204, 113, 0\.25\)$/);
  });

  it('produces an rgba() string from an already-rgb() input (a resolved MUI colour can be either)', () => {
    const out = withAlpha('rgb(94, 139, 196)', 0.5);
    expect(out).toMatch(/^rgba\(94, 139, 196, 0\.5\)$/);
  });
});

describe('criterion 7 (FE-3 slice) — the canvas half of the hex-literal scan', () => {
  const SOURCE = import.meta.glob(
    ['/src/app/shared/charts/structure-field/StructureFieldCanvas.tsx'],
    { query: '?raw', import: 'default', eager: true },
  ) as Record<string, string>;

  it('the glob is not vacuous', () => {
    expect(Object.keys(SOURCE).length).toBe(1);
  });

  it('StructureFieldCanvas.tsx carries zero `#RRGGBB`-style hex literals (all colour now arrives via `palette`/`surfaces` props)', () => {
    const [src] = Object.values(SOURCE);
    const withoutComments = src
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
      .replace(/^\s*\/\/.*$/gm, '');
    const hexMatches = withoutComments.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hexMatches).toEqual([]);
  });
});

/**
 * arc.ts — unit tests for the convex-arc builders PLUS the redesign-stage-2 §8-1 STRUCTURAL
 * enforcement of the signature rule (convexa-design skill: "arc in exactly 3 places — count
 * importers of the arc component"):
 *
 *   1. `shared/ui/arc.ts` has EXACTLY the three permitted importers — asserted as SET EQUALITY
 *      against the allowlist (a swap-one-in-one-out fails, not just a count drift), and the
 *      barrel (`shared/ui/index.ts`) must NOT re-export it (keeps this scan sound).
 *   2. The ArcDivider SEAM PIN: its importers are exactly the two named seams (§5.2). Extending
 *      the seam list is a deliberate edit of this pin (the P/L-color-pin pattern), never a
 *      drive-by.
 *
 * Scans use the Vite `?raw` glob idiom and are MUTATION-GUARDED per the house rule (a scan that
 * can't fail is worthless): the extracted checkers are proven to flag a 4th-importer fixture.
 */
import { describe, expect, it } from 'vitest';
import {
  ARC_X_PATHS,
  ARC_X_VIEWBOX,
  bowedArcPath,
  bowedControl,
  quadArcLength,
  quadArcPath,
} from './arc';

// Eager raw glob over ALL app sources (specs excluded — they may quote import strings in
// fixtures). Keys are `/src/app/...` paths, anchored at the Vite root (apps/dashboard).
const APP_SOURCES = import.meta.glob(['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Pure checker (mutation-tested): does a source import the arc primitive module?
 *  Covers the alias form (`@/shared/ui/arc`) AND any relative equivalent (`./arc`, `../ui/arc`). */
const importsArcPrimitive = (src: string): boolean => /from\s+['"][^'"]*\/arc['"]/.test(src);

/** Pure checker (mutation-tested): does a source import the ArcDivider component? */
const importsArcDivider = (src: string): boolean => /from\s+['"][^'"]*\/ArcDivider['"]/.test(src);

const filesWhere = (pred: (src: string) => boolean): string[] =>
  Object.entries(APP_SOURCES)
    .filter(([, src]) => pred(src))
    .map(([file]) => file)
    .sort();

describe('arc.ts · the quadratic-arc builders (pure geometry)', () => {
  it('quadArcPath emits a single M…Q… segment', () => {
    expect(quadArcPath([0, 10], [5, 0], [10, 10])).toBe('M 0 10 Q 5 0 10 10');
  });

  it('bowedControl displaces the chord midpoint perpendicular (horizontal chord → upward)', () => {
    // Left normal of a left→right horizontal chord points UP (smaller y in SVG coordinates).
    expect(bowedControl([0, 17], [100, 17], 4)).toEqual([50, 13]);
    expect(bowedArcPath([0, 17], [100, 17], 4)).toBe('M 0 17 Q 50 13 100 17');
  });

  it('quadArcLength: a degenerate arc (control on the chord) measures the chord', () => {
    expect(quadArcLength([0, 0], [50, 0], [100, 0])).toBeCloseTo(100, 6);
    // And a real bow measures strictly longer than its chord.
    expect(quadArcLength([0, 0], [50, -40], [100, 0])).toBeGreaterThan(100);
  });

  it('the arc-X glyph is two convex arcs (Q segments, never straight diagonals)', () => {
    expect(ARC_X_PATHS).toHaveLength(2);
    for (const d of ARC_X_PATHS) expect(d).toMatch(/^M [\d. ]+Q [\d. ]+$/);
    expect(ARC_X_VIEWBOX).toBe('0 0 100 100');
  });
});

describe('§8-1 · arc-in-exactly-3-places — importer SET EQUALITY (mutation-guarded)', () => {
  it('the scan is not vacuous (app sources actually loaded)', () => {
    expect(Object.keys(APP_SOURCES).length).toBeGreaterThan(40);
    expect(Object.keys(APP_SOURCES)).toContain('/src/app/shell/ConvexaMark.tsx');
  });

  it('MUTATION GUARD: the checkers flag a 4th-importer fixture and ignore near-misses', () => {
    // A hypothetical 4th importer MUST be caught by the scan.
    expect(importsArcPrimitive(`import { quadArcPath } from '@/shared/ui/arc';`)).toBe(true);
    expect(importsArcPrimitive(`import { bowedArcPath } from '../ui/arc';`)).toBe(true);
    expect(importsArcPrimitive(`import { quadArcPath } from './arc';`)).toBe(true);
    // Near-misses must NOT count as arc-primitive imports (ArcDivider is its own pin below).
    expect(importsArcPrimitive(`import { ArcDivider } from '@/shared/ui/ArcDivider';`)).toBe(false);
    expect(importsArcPrimitive(`import { Box } from '@mui/material';`)).toBe(false);
    expect(importsArcDivider(`import { ArcDivider } from '@/shared/ui/ArcDivider';`)).toBe(true);
    expect(importsArcDivider(`import { quadArcPath } from '@/shared/ui/arc';`)).toBe(false);
  });

  it('arc.ts importers == {ConvexaMark, HeroCurve, ArcDivider} — SET equality, a 4th is a red build', () => {
    expect(filesWhere(importsArcPrimitive)).toEqual([
      '/src/app/pages/landing/HeroCurve.tsx',
      '/src/app/shared/ui/ArcDivider.tsx',
      '/src/app/shell/ConvexaMark.tsx',
    ]);
  });

  it('the shared/ui barrel does NOT re-export the primitive (keeps this scan sound)', () => {
    const barrel = APP_SOURCES['/src/app/shared/ui/index.ts'];
    expect(barrel, 'shared/ui/index.ts must exist').toBeTruthy();
    expect(importsArcPrimitive(barrel)).toBe(false);
    expect(/export\s+(\*|\{[^}]*\})\s+from\s+['"]\.\/arc['"]/.test(barrel)).toBe(false);
    // …and it does not re-export ArcDivider either (same soundness argument for the seam pin).
    expect(importsArcDivider(barrel)).toBe(false);
  });

  it('SEAM PIN: ArcDivider importers == the two named seams (§5.2) — extending is a pin edit', () => {
    expect(filesWhere(importsArcDivider)).toEqual([
      '/src/app/features/trading/outcomes/TrackRecordSection.tsx',
      '/src/app/shell/Footer.tsx',
    ]);
  });
});

/**
 * AC-45b (partial) + SPEC §2.2 — the declared z-index ladder and the ADDITIVE breakpoint keys.
 * Redefining xs/sm/md/lg/xl is REJECTED: 57 `sx` sites across 26 files use them and four hooks
 * call down('sm'|'md') / up('lg'). Every existing key's value stays byte-identical, asserted here.
 */
import { describe, expect, it } from 'vitest';
import { lightTheme, theme } from './theme';

const APP_SOURCES = import.meta.glob(['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('z-index ladder (SPEC §2.2)', () => {
  for (const t of [theme, lightTheme]) {
    it(`${t.palette.mode}: every rung is declared and no MUI default floats above the ladder`, () => {
      expect(t.zIndex.appBar).toBe(20);
      expect(t.zIndex.drawer).toBe(30);
      expect(t.zIndex.modal).toBe(40);
      expect(t.zIndex.snackbar).toBe(50);
      expect(t.zIndex.tooltip).toBe(60);
      // These three have NO consumers, but left at MUI's 1000–1050 defaults they sit above every
      // v2 rung. Giving them values is the whole point.
      expect(t.zIndex.mobileStepper).toBeLessThan(20);
      expect(t.zIndex.fab).toBeLessThan(20);
      expect(t.zIndex.speedDial).toBeLessThan(20);
    });
  }
});

describe('breakpoints — additive keys only (SPEC §2.2)', () => {
  it('every shipped key keeps its exact value', () => {
    expect(theme.breakpoints.values.xs).toBe(0);
    expect(theme.breakpoints.values.sm).toBe(600);
    expect(theme.breakpoints.values.md).toBe(900);
    expect(theme.breakpoints.values.lg).toBe(1200);
    expect(theme.breakpoints.values.xl).toBe(1536);
  });

  it('the five v2 bands land alongside them, in ascending order', () => {
    const v = theme.breakpoints.values as Record<string, number>;
    expect(v.tablet).toBe(768);
    expect(v.smallLaptop).toBe(1000);
    expect(v.laptop).toBe(1100);
    expect(v.desktop).toBe(1300);
    expect(v.wide).toBe(1600);
    const ordered = theme.breakpoints.keys.map((k) => v[k]);
    expect([...ordered].sort((a, b) => a - b)).toEqual(ordered);
  });

  it('PIN: no app source calls breakpoints.only() or .not() — both derive from ADJACENT keys, so inserting a key changes their meaning', () => {
    const callers = Object.entries(APP_SOURCES)
      .filter(([, src]) => /breakpoints\s*\.\s*(only|not)\s*\(/.test(src))
      .map(([f]) => f);
    expect(callers, `breakpoints.only()/.not() would silently change meaning`).toEqual([]);
  });
});

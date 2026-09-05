/**
 * AC-45b — the FOUR declared radius roles are landed: panels 12 · dialogs 16 · controls 8 ·
 * pills 999. One `shape.borderRadius` value cannot serve four roles, so the other three are theme
 * overrides. The per-site judgement across the 38 numeric sites is REVIEW (build report), because
 * no test can catch a wrong one — this spec pins the four role values and the exemption list.
 */
import { describe, expect, it } from 'vitest';
import { lightTheme, theme } from './theme';
import { shape } from './tokens';

const SOURCES = import.meta.glob(['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const appPath = (k: string) => k.replace(/^\/src\/app\//, '');
const NUMERIC_RADIUS = /borderRadius:\s*([0-9]+(?:\.[0-9]+)?)\s*[,}\n]/g;

/**
 * PILL sites — a local `999` is a DECLARED role, not a stray number, so it is exempted from the
 * "no bare multiplier" arm by name. Live-checked: a listed path that no longer carries a 999
 * radius red-builds (the arc importer-set idiom).
 */
const PILL_SITES = [
  'pages/landing/Landing.tsx',
  'shared/ui/ComingSoonCard.tsx',
  'features/auth/AccountControl.tsx',
  'features/trading/positions/CustomizationToolbar.tsx',
];

const overrideRoot = (t: typeof theme, key: string) =>
  (t.components as any)?.[key]?.styleOverrides?.root;

describe('AC-45b — the four declared radius roles', () => {
  it('PANEL: shape.borderRadius is 12', () => {
    expect(shape.borderRadius).toBe(12);
    expect(theme.shape.borderRadius).toBe(12);
    expect(lightTheme.shape.borderRadius).toBe(12);
  });

  it('DIALOG: MuiDialog paper is 16', () => {
    for (const t of [theme, lightTheme]) {
      expect((t.components as any)?.MuiDialog?.styleOverrides?.paper?.borderRadius).toBe(16);
    }
  });

  it('CONTROL: every control family is 8', () => {
    for (const t of [theme, lightTheme]) {
      for (const key of [
        'MuiButton',
        'MuiOutlinedInput',
        'MuiFilledInput',
        'MuiInputBase',
        'MuiToggleButton',
      ]) {
        expect(overrideRoot(t, key)?.borderRadius, `${key} control radius`).toBe(8);
      }
    }
  });

  it('PILL: every declared pill site still carries a 999 radius (LIVE list)', () => {
    for (const file of PILL_SITES) {
      const entry = Object.entries(SOURCES).find(([k]) => appPath(k) === file);
      if (!entry) throw new Error(`${file} listed as a pill site but missing — remove the entry`);
      expect(entry[1], `${file} no longer carries borderRadius: 999 — remove the entry`).toMatch(
        /borderRadius:\s*999/,
      );
    }
  });

  it('no source carries a numeric borderRadius above 3 except the declared pill 999', () => {
    // A bare `borderRadius: 12` now renders 144px. Anything above the small-multiplier band is a
    // px value pasted where a multiplier is read — the exact defect the 1.2x scaling produces.
    const bad: string[] = [];
    for (const [key, src] of Object.entries(SOURCES)) {
      const file = appPath(key);
      if (file.startsWith('shared/theme/')) continue;
      for (const m of src.matchAll(NUMERIC_RADIUS)) {
        const n = Number(m[1]);
        if (n > 3 && n !== 999) bad.push(`${file} → borderRadius: ${n}`);
      }
    }
    expect(bad, `numeric borderRadius is a MULTIPLIER (n x 12px):\n${bad.join('\n')}`).toEqual([]);
  });
});

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

// ---------------------------------------------------------------------------------------------
// U-35 (curvature-v2-surfaces, scanner half) — the panel-role container radius is on the ladder.
//
// The NUMERIC_RADIUS regex above cannot see a STRING radius (`borderRadius: '10px'`) at all — that
// is exactly why `ScanTable.tsx` and `ScanCard.tsx` survived the scan above with a hand-pasted
// '10px' where the panel role (`shape.borderRadius` = 12, i.e. `borderRadius: 1`) belongs. This is
// scoped to the two named sites (not a whole-app string-radius sweep): U-35 names exactly THREE
// off-ladder sites phase-wide (SettingsPage.tsx:67, owned by FE-8, plus these two), and a blanket
// scan would fail dozens of unrelated, out-of-scope files this phase does not touch.
// ---------------------------------------------------------------------------------------------
const STRING_PX_RADIUS = /borderRadius:\s*'(\d+)px'/g;

/**
 * Live-checked: a listed site that no longer carries its named string px radius red-builds — the
 * arc importer-set idiom, same shape as `PILL_SITES` above. Scoped to the EXACT '10px' the panel
 * containers carried (not a blanket string-radius ban): both files also carry unrelated '4px'
 * CONTROL-role radii (`ScanTable.tsx` sort button, symbol link) that are pre-existing carried debt,
 * not named by U-35, and out of scope for this task.
 */
const SCANNER_PANEL_RADIUS_SITES = ['pages/scanner/ScanTable.tsx', 'pages/scanner/ScanCard.tsx'];
const PANEL_ROLE_PX = '10';

describe('U-35 (scanner half) — the panel container radius is `1`, never a raw px string', () => {
  it('MUTATION GUARD: the string-radius needle catches what NUMERIC_RADIUS cannot', () => {
    const fixture = `borderRadius: '10px',`;
    expect(/borderRadius:\s*([0-9]+(?:\.[0-9]+)?)\s*[,}\n]/.test(fixture)).toBe(false);
    expect([...fixture.matchAll(STRING_PX_RADIUS)]).toHaveLength(1);
  });

  it('neither scanner panel container carries the old `10px` string radius any more', () => {
    const offenders: string[] = [];
    for (const file of SCANNER_PANEL_RADIUS_SITES) {
      const entry = Object.entries(SOURCES).find(([k]) => appPath(k) === file);
      if (!entry) throw new Error(`${file} missing from the source scan`);
      for (const m of entry[1].matchAll(STRING_PX_RADIUS)) {
        if (m[1] === PANEL_ROLE_PX) offenders.push(`${file} → borderRadius: '${m[1]}px'`);
      }
    }
    expect(offenders, `string px borderRadius survives:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('both sites carry the panel-role multiplier (borderRadius: 1) instead', () => {
    for (const file of SCANNER_PANEL_RADIUS_SITES) {
      const entry = Object.entries(SOURCES).find(([k]) => appPath(k) === file);
      if (!entry) throw new Error(`${file} missing from the source scan`);
      expect(entry[1], `${file} must declare borderRadius: 1 (the panel role)`).toMatch(
        /borderRadius:\s*1\s*,/,
      );
    }
  });
});

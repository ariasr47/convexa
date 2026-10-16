/**
 * Text-token contrast floors, BOTH schemes, GATED not just narrated: `steel2` (AC-42,
 * `extras.textTertiary`), `textDim` and `textInfo` (PR #46 CI repair §A). One in-spec WCAG
 * luminance/contrast helper and one floor table. This file folds the three former per-token
 * contrast specs (lean-tests batch 58); the amber text and focus-ring pins stay in
 * `stage3-amber.spec.ts` §8-7/§8B-2.
 *
 * The surfaces are the REAL ones each token's consumers paint on today (found by source grep):
 *   - dark: `ink` (page canvas), `panel` (card bodies, ScanCells's `cell-price`), `well` (the inset
 *     body of the seven `bodyVariant="inset"` ticker widgets, TopNav's search trigger,
 *     TapePulseStrip's flat strip).
 *   - light: `panelRaised` (`#ECECE7`, dialogs, toolbars, ScanTable row hover, PositionBrief's chip:
 *     the DARKEST real light surface and the binding floor), `well` (`#F1F1EC`), `paper`
 *     (`background.default`) and white (`background.paper`, Widget/CellCard/dialog papers).
 *   - `textInfo` sits on tinted fills, so its rows composite the fill first: `alpha(info.main, 0.16)`
 *     (ConnectionChip) and `action.selected` (16% white dark / 8% black light; MidTapeChip and the
 *     ladder live badge).
 *
 * `steel2`'s dark floors are the canon's: "≥4.8:1" on panel (reused for `well`), and the measured
 * 5.18:1 on ink pinned at 5.15 with headroom (the canon's "5.2:1" is a rounding, not a "≥" floor).
 * Light `steel2` follows owner ruling 7 (2026-09-03, `council/decisions.md`): clear 4.5:1 on every
 * light surface where it can actually appear.
 *
 * `panelRaised2` (`raised2`, `#E3E3DD`) is DELIBERATELY excluded from the steel2 light floor: no
 * component paints steel2 on it. Darkening far enough to also clear it (`#58657D`, 4.56:1 there)
 * would be un-evidenced AND would invert the tertiary-quieter-than-secondary hierarchy on white
 * (5.88:1 vs `text.secondary`'s composited 5.74:1). Its only consumers are the two avatar discs
 * (ruling A, 2026-10-15: the Final shell board's neutral `.ss-av`), which paint `text.primary` on it,
 * gated by its own floor row below. The liveness guard red-builds the day any OTHER file consumes
 * `panelRaised2`, which is the trigger to check what it paints there and redo the floor.
 */
import { describe, expect, it } from 'vitest';
import { extras, extrasLight, palette } from './tokens';

// ---- WCAG relative-luminance / contrast, computed IN-SPEC ----------------------------------------
type Rgb = [number, number, number];

const hexToRgb = (hex: string): Rgb => {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Composite an `rgba()`/`rgb()` string over an OPAQUE hex surface (dark `textTertiary` is alpha). */
const rgbaOverHex = (rgba: string, surfaceHex: string): Rgb => {
  const m = rgba.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`not an rgb()/rgba() string: ${rgba}`);
  const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
  const [r, g, b, a = 1] = parts;
  const [br, bg, bb] = hexToRgb(surfaceHex);
  return [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a)];
};

const relLuminance = ([r, g, b]: Rgb): number => {
  const lin = (c: number) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const contrastRgb = (a: Rgb, b: Rgb): number => {
  const [hi, lo] = [relLuminance(a), relLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Contrast of a token colour (hex OR alpha rgba) against an OPAQUE surface hex. */
const contrastOn = (fg: string, surfaceHex: string): number =>
  contrastRgb(
    fg.startsWith('#') ? hexToRgb(fg) : rgbaOverHex(fg, surfaceHex),
    hexToRgb(surfaceHex),
  );

/** Composite an opaque `overlayHex` at `alpha` over an opaque `surfaceHex` (a tinted chip fill). */
const compositeOver = (surfaceHex: string, overlayHex: string, alpha: number): string => {
  const [sr, sg, sb] = hexToRgb(surfaceHex);
  const [or_, og, ob] = hexToRgb(overlayHex);
  const mix = (o: number, s: number) => Math.round(o * alpha + s * (1 - alpha));
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(mix(or_, sr))}${toHex(mix(og, sg))}${toHex(mix(ob, sb))}`;
};

/** The same named surfaces with a tint composited over each. */
const tinted = (
  surfaces: Record<string, string>,
  overlayHex: string,
  alpha: number,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(surfaces).map(([name, hex]) => [name, compositeOver(hex, overlayHex, alpha)]),
  );

const DARK = { ink: '#0B0F17', panel: '#131A24', well: '#0D121B' };
const LIGHT = { white: '#ffffff', paper: '#F6F6F3', panelRaised: '#ECECE7', well: '#F1F1EC' };

const FLOORS: Array<{ label: string; fg: string; on: Record<string, string>; floor: number }> = [
  {
    label: 'steel2 dark on panel and well (canon "≥4.8:1" on panel)',
    fg: extras.textTertiary,
    on: { panel: DARK.panel, well: DARK.well },
    floor: 4.8,
  },
  {
    label: 'steel2 dark on ink (measured 5.18, pinned with headroom)',
    fg: extras.textTertiary,
    on: { ink: DARK.ink },
    floor: 5.15,
  },
  {
    label: 'steel2 light on every real light surface (owner ruling 7)',
    fg: extrasLight.textTertiary,
    on: LIGHT,
    floor: 4.5,
  },
  {
    label: 'text.primary dark on raised2 (the avatar discs, ruling A)',
    fg: palette.dark.text.primary,
    on: { raised2: extras.panelRaised2 },
    floor: 4.5,
  },
  {
    label: 'text.primary light on raised2 (the avatar discs, ruling A)',
    fg: palette.light.text.primary,
    on: { raised2: extrasLight.panelRaised2 },
    floor: 4.5,
  },
  {
    label: 'textDim dark on every real dark surface (panel, the cell-price offender, hardest)',
    fg: extras.textDim,
    on: DARK,
    floor: 4.5,
  },
  {
    label: 'textDim light on every real light surface (panelRaised hardest)',
    fg: extrasLight.textDim,
    on: LIGHT,
    floor: 4.5,
  },
  {
    label: 'textInfo dark on alpha(info.main, 0.16) over every dark surface (ConnectionChip)',
    fg: extras.textInfo,
    on: tinted(DARK, palette.dark.info, 0.16),
    floor: 4.5,
  },
  {
    label: 'textInfo dark on action.selected (16% white) over every dark surface (live badges)',
    fg: extras.textInfo,
    on: tinted(DARK, '#ffffff', 0.16),
    floor: 4.5,
  },
  {
    label: 'textInfo light on alpha(info.main, 0.16) over every light surface',
    fg: extrasLight.textInfo,
    on: tinted(LIGHT, palette.light.info, 0.16),
    floor: 4.5,
  },
  {
    label: 'textInfo light on action.selected (8% black) over every light surface',
    fg: extrasLight.textInfo,
    on: tinted(LIGHT, '#000000', 0.08),
    floor: 4.5,
  },
];

describe('text-token contrast floors, both schemes (steel2, textDim, textInfo)', () => {
  it('sanity: the contrast helper reproduces the known black/white extremes', () => {
    expect(contrastOn('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastOn('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it.each(FLOORS)('$label clears $floor:1', ({ fg, on, floor }) => {
    for (const [name, surface] of Object.entries(on)) {
      expect(contrastOn(fg, surface), name).toBeGreaterThanOrEqual(floor);
    }
  });

  // The reviewed consumers: each paints `text.primary` (never steel2) on raised2 — the avatar disc
  // shared by the nav and Settings, and the phone drawer's account row disc.
  const RAISED2_CONSUMERS = ['features/auth/avatar.ts', 'shell/TopNav.tsx'];

  it('LIVENESS GUARD: `panelRaised2` (raised2) has no consumer beyond the reviewed avatar discs — the premise the steel2 light floor rests on', () => {
    const sources = import.meta.glob(
      [
        '/src/app/pages/**/*.{ts,tsx}',
        '/src/app/features/**/*.{ts,tsx}',
        '/src/app/shell/**/*.{ts,tsx}',
        '/src/app/shared/**/*.{ts,tsx}',
        '!/src/app/shared/theme/**', // the token definition + this token-hygiene family of specs
        '!**/*.spec.{ts,tsx}',
      ],
      { query: '?raw', import: 'default', eager: true },
    ) as Record<string, string>;
    // Anti-vacuity — the glob must see the real source tree, or the scan below passes vacuously.
    expect(Object.keys(sources).length).toBeGreaterThan(40);
    const hits = Object.entries(sources)
      .filter(([, src]) => src.includes('panelRaised2'))
      .map(([file]) => file.replace(/^\/src\/app\//, ''))
      .sort();
    expect(
      hits,
      'a new file consumes panelRaised2 (raised2) — check what it paints there; re-run the steel2 ' +
        'light floor if it is tertiary text ' +
        '(owner ruling 7 conditioned #5D6B84 on it staying unconsumed; #58657D clears raised2 too, ' +
        'at the cost of inverting the tertiary/secondary hierarchy on white — see the top-of-file note)',
    ).toEqual(RAISED2_CONSUMERS);
  });
});

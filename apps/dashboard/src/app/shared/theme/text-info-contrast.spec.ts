/**
 * PR #46 CI repair, §A — `textInfo` (`extras.textInfo`) measured contrast, BOTH schemes, against
 * the REAL composited surfaces (mirrors `steel2-contrast.spec.ts` / `text-dim-contrast.spec.ts`'s
 * in-spec WCAG luminance/contrast method).
 *
 * `info.main` (signal) is deliberately the QUIETEST fill in the palette ("links / live status —
 * deliberately quieter than amber", `tokens.ts` top-of-file note) — exactly why it fails as small
 * TEXT sat on its own tint. Three real sites measured under WCAG AA 4.5:1 (`color-contrast`,
 * serious, `browser:a11y`): `ConnectionChip.tsx`'s "live · mid …" label (4.43:1, `alpha(info.main,
 * 0.16)` tint over `ink`), `StructureHeroPanel.tsx`'s `mid · tape` badge and `FigureCell.tsx`'s
 * ladder live badge word (3.7:1 each, `bgcolor: 'action.selected'` composited fill).
 * `success`/`error`/`warning` do NOT share this failure at the SAME `alpha(tone,0.16)` formula
 * (computed here too, for the record — real headroom), so this is `info` alone, not the pattern.
 *
 * Two DIFFERENT real backgrounds this token is checked against, because the three sites use two
 * different fill formulas:
 *   - `alpha(info.main, 0.16)` over ink/panel/well (`ConnectionChip`'s own tint)
 *   - `action.selected` (16% white in dark, 8% black in light) over ink/panel/well /
 *     white/paper/panelRaised/well (`MidTapeChip` / the ladder live badge)
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

const contrastOn = (fgHex: string, surfaceHex: string): number =>
  contrastRgb(hexToRgb(fgHex), hexToRgb(surfaceHex));

/** Composite an opaque `overlayHex` at `alpha` over an opaque `surfaceHex` (both real fills used
 *  by the three sites: `alpha(info.main, 0.16)` and `action.selected`'s white/black tints). */
const compositeOver = (surfaceHex: string, overlayHex: string, alpha: number): string => {
  const [sr, sg, sb] = hexToRgb(surfaceHex);
  const [or_, og, ob] = hexToRgb(overlayHex);
  const mix = (o: number, s: number) => Math.round(o * alpha + s * (1 - alpha));
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(mix(or_, sr))}${toHex(mix(og, sg))}${toHex(mix(ob, sb))}`;
};

const DARK = { ink: '#0B0F17', panel: '#131A24', well: '#0D121B' };
const LIGHT = { white: '#ffffff', paper: '#F6F6F3', panelRaised: '#ECECE7', well: '#F1F1EC' };

describe('PR46 §A — textInfo (extras.textInfo) contrast floor, both schemes, on the REAL composited fills', () => {
  it('dark: clears WCAG AA 4.5:1 on `alpha(info.main, 0.16)` composited over every real dark surface (ConnectionChip)', () => {
    for (const [name, surface] of Object.entries(DARK)) {
      const bg = compositeOver(surface, palette.dark.info, 0.16);
      expect(contrastOn(extras.textInfo, bg), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('dark: clears WCAG AA 4.5:1 on `action.selected` (16% white) composited over every real dark surface (MidTapeChip / ladder live badge)', () => {
    for (const [name, surface] of Object.entries(DARK)) {
      const bg = compositeOver(surface, '#ffffff', 0.16);
      expect(contrastOn(extras.textInfo, bg), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('dark: success/error/warning do NOT share the info failure at the same alpha(tone,0.16) formula — this is info alone', () => {
    const tones: Record<string, string> = {
      success: palette.dark.success,
      error: palette.dark.error,
      warning: palette.dark.warning,
    };
    for (const [name, hex] of Object.entries(tones)) {
      const bg = compositeOver(DARK.panel, hex, 0.16); // panel = the hardest of the three
      expect(contrastOn(hex, bg), name).toBeGreaterThanOrEqual(4.5);
    }
    // info itself, unfixed, measurably fails the same check (the premise this token corrects).
    const infoBg = compositeOver(DARK.panel, palette.dark.info, 0.16);
    expect(contrastOn(palette.dark.info, infoBg)).toBeLessThan(4.5);
  });

  it('light: clears WCAG AA 4.5:1 on `alpha(info.main, 0.16)` composited over every real light surface', () => {
    for (const [name, surface] of Object.entries(LIGHT)) {
      const bg = compositeOver(surface, palette.light.info, 0.16);
      expect(contrastOn(extrasLight.textInfo, bg), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('light: clears WCAG AA 4.5:1 on `action.selected` (8% black) composited over every real light surface', () => {
    for (const [name, surface] of Object.entries(LIGHT)) {
      const bg = compositeOver(surface, '#000000', 0.08);
      expect(contrastOn(extrasLight.textInfo, bg), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('token parity: textInfo is distinct in each scheme (no dark-value fallback in light mode)', () => {
    expect(extrasLight.textInfo).not.toBe(extras.textInfo);
  });
});

/**
 * PR #46 CI repair, section A — `textDim` (`extras.textDim`) measured contrast, BOTH schemes,
 * GATED not just narrated (mirrors `steel2-contrast.spec.ts`'s in-spec WCAG luminance/contrast
 * method — same math, new token).
 *
 * `textDim` replaces `opacity: 0.5` on text at four real call sites the accessibility gate's
 * `color-contrast` (serious) rule caught (`browser:a11y`, 7 of 9 scans): `TickerHeader.tsx`'s
 * last-trade readout (offline / session-tape-dropped), `TapePulseStrip.tsx`'s paused `Mid` value,
 * `FigureCell.tsx`'s `ValueGlyph`/`FigureRow` dimmed value glyph (`figureState.ts`'s `dim: true`
 * on `offline-retained`/`offline-bare`), and `ScanCells.tsx`'s `cell-price` in the same state.
 * Opacity composites the foreground with whatever sits behind it, so it carries no contrast
 * guarantee — `#7e7f7d` on `#131a24` (the shipped `cell-price` offender) measured 4.34:1, under the
 * WCAG AA 4.5:1 normal-text floor. `textDim` is a SOLID colour instead, measured against every real
 * dark/light surface these call sites paint on today.
 */
import { describe, expect, it } from 'vitest';
import { extras, extrasLight } from './tokens';

// ---- WCAG relative-luminance / contrast, computed IN-SPEC (mirrors steel2-contrast.spec.ts) ----
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

const contrastOn = (fgHex: string, surfaceHex: string): number => {
  const [hi, lo] = [relLuminance(hexToRgb(fgHex)), relLuminance(hexToRgb(surfaceHex))].sort(
    (x, y) => y - x,
  );
  return (hi + 0.05) / (lo + 0.05);
};

// Real dark surfaces `textDim` renders on today: `ink` (TickerHeader's last-trade sits on the page
// background), `panel` (ScanCells's `cell-price`, FigureCell's card body — the shipped offender's
// own surface), `well` (an inset widget body / TapePulseStrip's flat strip).
const DARK = { ink: '#0B0F17', panel: '#131A24', well: '#0D121B' };
// Real light surfaces (same floor `steel2` clears — `panelRaised` is the darkest, the binding one).
const LIGHT = { white: '#ffffff', paper: '#F6F6F3', panelRaised: '#ECECE7', well: '#F1F1EC' };

describe('PR46 §A — textDim (extras.textDim) contrast floor, both schemes', () => {
  it('dark: clears WCAG AA 4.5:1 on every real dark surface, `panel` (the shipped cell-price offender surface) the hardest', () => {
    expect(contrastOn(extras.textDim, DARK.panel)).toBeGreaterThanOrEqual(4.5);
    expect(contrastOn(extras.textDim, DARK.well)).toBeGreaterThanOrEqual(4.5);
    expect(contrastOn(extras.textDim, DARK.ink)).toBeGreaterThanOrEqual(4.5);
  });

  it('dark: is genuinely a step quieter than steel/text.secondary — the reduced-emphasis intent still reads', () => {
    // steel (#8A9BB4, text.secondary's dark value) clears panel at ~6.19:1 — textDim sits below
    // that, still legible, never re-approaching the failing opacity-composited ~4.34:1 it replaces.
    expect(contrastOn(extras.textDim, DARK.panel)).toBeLessThan(contrastOn('#8A9BB4', DARK.panel));
    expect(contrastOn(extras.textDim, DARK.panel)).toBeGreaterThan(4.34);
  });

  it('light: clears WCAG AA 4.5:1 on every real light surface, `panelRaised` the hardest (same floor steel2 clears)', () => {
    expect(contrastOn(extrasLight.textDim, LIGHT.panelRaised)).toBeGreaterThanOrEqual(4.5);
    expect(contrastOn(extrasLight.textDim, LIGHT.well)).toBeGreaterThanOrEqual(4.5);
    expect(contrastOn(extrasLight.textDim, LIGHT.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrastOn(extrasLight.textDim, LIGHT.white)).toBeGreaterThanOrEqual(4.5);
  });

  it('token parity: textDim is distinct in each scheme (no dark-value fallback in light mode)', () => {
    expect(extrasLight.textDim).not.toBe(extras.textDim);
  });
});

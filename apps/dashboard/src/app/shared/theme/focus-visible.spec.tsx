/**
 * Stage 0 item 2 — the authored `:focus-visible` ring (redesign-stage-0 FRONTEND_EXECUTION_CONTRACT
 * §8.2; convexa-design skill rule 8 + its enforcement row "focus-visible presence — add at Stage 0").
 *
 * Two structural guards:
 *   1. RENDERED-STYLESHEET presence — the theme's `MuiCssBaseline` override injects the ONE global
 *      ring (2px `primary.main` outline + offset) for `*:focus-visible` AND the matching MUI
 *      ButtonBase treatment, in BOTH modes (the ring is token-bound: dark and light each bind to
 *      their own `primary.main`). The coarse-pointer ≥44px touch-target floor rides the same
 *      baseline override and is asserted here too (item 4).
 *   2. SOURCE-SCAN (`?raw`, mutation-tested) — no component may set `outline: 'none'` (or 0) without
 *      an in-file `:focus-visible` replacement. The `Widget.tsx` frame is the accounted case: it
 *      keeps `outline: 'none'` for ringless MOUSE selection and now carries its own
 *      `&:focus-visible` ring — asserted explicitly.
 *
 * Testing gotcha honored: MUI `sx`/baseline styles compile into <style> tags — we assert on the
 * injected CSS TEXT (never `getAttribute('style')`).
 */
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import widgetSource from '@/shared/ui/Widget/Widget?raw';
import { lightTheme, theme } from './theme';

// ---- 1. Rendered-stylesheet presence -----------------------------------------------------------

/** All injected CSS, whitespace-normalized so serializer formatting can't flake the assertion. */
function injectedCss(): string {
  return Array.from(document.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .join('\n')
    .replace(/\s+/g, '');
}

afterEach(() => cleanup());

describe('authored :focus-visible ring — injected ONCE at the theme layer, both modes', () => {
  it.each([
    ['dark', theme],
    ['light', lightTheme],
  ])('%s mode: global ring + ButtonBase treatment bound to that mode’s primary token', (_mode, t) => {
    render(
      <ThemeProvider theme={t}>
        <CssBaseline />
        <span />
      </ThemeProvider>,
    );
    const css = injectedCss();
    const ring = `outline:2pxsolid${t.palette.primary.main}`.replace(/\s+/g, '');

    // The one global rule (keyboard focus only — :focus-visible, not :focus).
    expect(css).toContain(`*:focus-visible{${ring}`);
    expect(css).toContain('outline-offset:2px');
    // The matching MUI ButtonBase treatment (beats ButtonBase's own `outline: 0` reset).
    expect(css).toMatch(/\.MuiButtonBase-root:focus-visible,\.MuiButtonBase-root\.Mui-focusVisible\{/);

    // Item 4 rider: the coarse-pointer ≥44px touch-target floor is injected by the same override.
    expect(css).toContain('@media(pointer:coarse)');
    expect(css).toContain('min-height:44px');
    expect(css).toContain('min-width:44px');
  });
});

// ---- 2. Source-scan: no outline:'none' without an in-file :focus-visible replacement -------------

const SOURCES = import.meta.glob(
  [
    '/src/app/pages/**/*.{ts,tsx}',
    '/src/app/features/**/*.{ts,tsx}',
    '/src/app/shell/**/*.{ts,tsx}',
    '/src/app/shared/ui/**/*.{ts,tsx}',
    '!**/*.spec.{ts,tsx}',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const OUTLINE_KILL = /outline:\s*(?:['"]none['"]|0(?![.\d]))/;
const REPLACEMENT = /:focus-visible/;

/** Pure checker (exported to the mutation test below): files that strip the outline without an
 *  in-file `:focus-visible` replacement. */
function outlineViolations(files: Record<string, string>): string[] {
  return Object.entries(files)
    .filter(([, src]) => OUTLINE_KILL.test(src) && !REPLACEMENT.test(src))
    .map(([file]) => file);
}

describe('source scan — outline:none only with an in-file :focus-visible replacement', () => {
  it('the glob is not vacuous', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(40);
  });

  it('MUTATION GUARD: the scan actually fails on a violating source (a scan that can’t fail is worthless)', () => {
    expect(
      outlineViolations({ 'bad.tsx': `sx={{ outline: 'none' }}` }),
    ).toEqual(['bad.tsx']);
    expect(
      outlineViolations({
        'good.tsx': `sx={{ outline: 'none', '&:focus-visible': { outline: '2px solid' } }}`,
      }),
    ).toEqual([]);
  });

  it('no component strips the focus outline without replacing it in the same file', () => {
    expect(outlineViolations(SOURCES)).toEqual([]);
  });

  it('the Widget frame stays the accounted case: outline none FOR MOUSE + its own &:focus-visible ring', () => {
    expect(widgetSource).toMatch(OUTLINE_KILL);
    expect(widgetSource).toContain("'&:focus-visible'");
    expect(widgetSource).toContain('outlineOffset');
  });
});

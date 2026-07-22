/**
 * redesign-stage-1 §8-2 / §8-4 / §8-5 / §8-6 — the token map landed COMPLETE and the guarded
 * slots cannot drift:
 *   - §8-2 token-map completeness: every §3.1/§3.2 entry present with the NEW values (§3 dark
 *     values byte-exact), removed keys ABSENT, brandGradient composed only of the brand ambers.
 *   - §8-4 first-paint theme-color: the STATIC index.html meta === palette.dark.background.default
 *     byte-exact (guards §3.3-6 forever; the runtime meta is covered by theme-color.spec).
 *   - §8-5 P/L direction colors: literals pinned IN this spec — changing them requires editing
 *     the pin (a deliberate GATE Z act), never a side effect of a palette sweep.
 *   - §8-6 focus ring == brand: the dark ring renders in gammaAmber (guards a future primary
 *     remap silently decoupling ring from brand).
 */
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

// eslint-disable-next-line import/no-absolute-path -- Vite root-anchored raw import (house idiom)
import indexHtml from '/index.html?raw';
import { theme } from './theme';
import { brandGradient, extras, extrasLight, palette, typographyTokens } from './tokens';

describe('§8-2 · token-map completeness — no orphan token', () => {
  it('the six §3 dark values are byte-exact in their slots', () => {
    expect(palette.dark.background.default).toBe('#0B0F17'); // ink
    expect(palette.dark.background.paper).toBe('#131A24'); // panel
    expect(palette.dark.text.primary).toBe('#E9E4D6'); // phosphor
    expect(palette.dark.text.secondary).toBe('#8A9BB4'); // steel
    expect(palette.dark.primary.main).toBe('#F2A93B'); // gammaAmber — THE brand, dominant
    expect(palette.dark.info).toBe('#5E8BC4'); // signal — deliberately quieter
  });

  it('warning is burnt orange (dark) and the derived light values are the measured ones', () => {
    expect(palette.dark.warning).toBe('#E07A3F');
    expect(palette.light.warning).toBe('#A65526'); // measured 4.91:1 paper / 5.32:1 white
    expect(palette.light.info).toBe('#3D6DA5'); //    measured 4.94:1 paper / 5.34:1 white
    expect(palette.light.secondary.main).toBe('#5A6B85'); // measured 5.00:1 paper
  });

  it('light primary is the MEASURED amberDeep — the recorded §10-5 bounce from #C9821A', () => {
    // §3 gave #C9821A; it measured 2.90:1 on paper (< the 3:1 UI floor) and was minimally
    // darkened under the pre-authorized §5 bounce rule. This pin records the final value.
    expect(palette.light.primary.main).toBe('#C57F19');
    expect(palette.light.background.default).toBe('#F6F6F3'); // paper
  });

  it('theme-audit gaps closed: explicit secondary + contrastText + light text.primary', () => {
    expect(palette.dark.secondary.main).toBe('#8A9BB4'); // kills the MUI purple leak
    expect(palette.dark.secondary.contrastText).toBe('#0B0F17');
    expect(palette.dark.primary.contrastText).toBe('#0B0F17'); // ink on amber fills
    expect(palette.light.primary.contrastText).toBe('#17202B');
    expect(palette.light.text.primary).toBe('#17202B'); // explicit, no MUI default
    expect(palette.dark.text.disabled).toBe('rgba(138, 155, 180, 0.5)'); // steel @ 50% (§10-3)
  });

  it('removed keys are ABSENT — violet + the button fill rode out entirely', () => {
    expect('accentViolet' in extras).toBe(false);
    expect('buttonPrimaryBg' in extras).toBe(false);
    expect('accentViolet' in extrasLight).toBe(false);
    expect('buttonPrimaryBg' in extrasLight).toBe(false);
  });

  it('brandGradient is composed ONLY of the brand ambers (gammaAmber → amberDeep)', () => {
    expect(brandGradient).toBe('linear-gradient(135deg, #F2A93B, #C57F19)');
  });

  it('the type trio is the identity: Plex Sans body · Plex Mono data · Archivo display', () => {
    expect(typographyTokens.fontFamily).toContain('IBM Plex Sans');
    expect(typographyTokens.fontFamily).not.toContain('Inter'); // retired, not even a fallback
    expect(typographyTokens.monoFontFamily).toContain('IBM Plex Mono');
    expect(typographyTokens.monoFontFamily).not.toContain('Roboto Mono');
    expect(typographyTokens.displayFontFamily).toContain('Archivo');
    // The width treatment is a REAL font-stretch percentage — never a faux scaleX.
    expect(typographyTokens.displayFontStretch).toBe('112.5%');
  });
});

describe('§8-4 · first-paint theme-color matches the new ink byte-exactly', () => {
  it('the STATIC <meta name="theme-color"> content === palette.dark.background.default', () => {
    const m = indexHtml.match(/<meta name="theme-color" content="([^"]+)"/);
    expect(m, 'index.html must carry the static theme-color meta').toBeTruthy();
    expect(m![1]).toBe(palette.dark.background.default);
  });
});

describe('§8-5 · P/L direction colors byte-identical — RESERVED, pinned literals', () => {
  it('dark success/error and light success/error are the exact pre-swap values', () => {
    // Changing ANY of these four pins is a deliberate GATE Z act (outcome-ledger canon:
    // green/red are reserved for P/L direction and the palette sweep must not touch them).
    expect(palette.dark.success).toBe('#2ecc71');
    expect(palette.dark.error).toBe('#ff5c5c');
    expect(palette.light.success).toBe('#1e9e57');
    expect(palette.light.error).toBe('#d23b3b');
  });
});

describe('§8-6 · the focus ring is BRAND amber on the dark canvas', () => {
  afterEach(() => cleanup());

  it('the injected dark ring renders 2px solid gammaAmber (ring ≡ brand, not just ≡ primary)', () => {
    render(
      createElement(
        ThemeProvider,
        { theme },
        createElement(CssBaseline),
        createElement('span'),
      ),
    );
    const css = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent ?? '')
      .join('\n')
      .replace(/\s+/g, '');
    expect(css).toContain('*:focus-visible{outline:2pxsolid#F2A93B');
  });
});

/**
 * Landing CTA contrast — A11Y-2 (`color-contrast`, serious), light scheme (F7c).
 *
 * The conductor's cold accessibility gate on `/` (scan A11Y-2, 1280×900, LIGHT, anonymous) reported
 * two `color-contrast` findings: `target_selector: ".MuiButton-sizeMedium"` (`cta-methodology`,
 * "Read the methodology →" — the only Button on `/` without an explicit `size`, so it is the only
 * element that class alone identifies) and `target_selector: 'button[data-testid="cta-band-secondary"]'`
 * ("Sign in"). Root cause, measured (`browser:a11y`, `@axe-core/playwright`, `evaluate`d computed
 * styles): MUI's `outlined`/`text` Button variants label themselves with `primary.main` by default —
 * the FILL-grade amber (`amberDeep`, light mode), only measured to the ≥3:1 UI-component floor
 * (`tokens.ts`'s own comment: "3.02:1 on paper, 3.27:1 on white"). Both measured UNDER the 4.5:1 text
 * floor: `cta-methodology` 3.01:1 on `background.default`, `cta-band-secondary` 3.26:1 on
 * `background.paper` (axe `failureSummary`, reproduced below).
 *
 * A third landing CTA, `cta-secondary` ("How it's built"), shares the exact same
 * `primary.main`-as-text pattern and measures 3.02:1 on `background.default` too — but axe scores it
 * "incomplete", not "violation": `HeroCurve`'s decorative SVG sits behind the whole hero column, so
 * axe's `imgNode` heuristic can't be certain of the composited background and declines to score
 * anything in that column (the H1, the sub, the spine and the footnote are ALL "incomplete" for the
 * same reason). That is an axe blind spot, not evidence the pixels are fine, so this spec checks
 * every landing CTA — not only the two the gate happened to catch — plus the hero chip (found while
 * fixing the three CTAs: same file, same `primary.main`-as-text mechanism, measured 2.68:1 on its own
 * composited tint; fixed alongside them since the DESIGN_SYSTEM.md rule it violates is general, not
 * button-specific, and the `Eyebrow` component two lines above it in this same file already binds
 * `extrasFor(theme).textAmber` for exactly this reason).
 *
 * Fix (`DESIGN_SYSTEM.md` "Two amber grades" — `[theme-token-discipline]`): `primary.main` stays the
 * FILL/border (the ≥3:1 UI class; MUI derives the outlined border from it independently of the label
 * colour, so the border is untouched by this change). The LABEL moves to
 * `extrasFor(theme).textAmber` (the ≥4.5:1 text class). Dark is byte-identical
 * (`extras.textAmber === gammaAmber`, `tokens.ts`), so only light-mode pixels move — the dark scan
 * (A11Y-1) already passed and stays passing.
 *
 * Two proofs, matching this repo's contrast idiom (`shared/theme/text-dim-contrast.spec.ts` /
 * `text-info-contrast.spec.ts`): (1) pure token math — `extrasFor(theme).textAmber` clears 4.5:1 on
 * every real background a landing CTA or the hero chip sits on, in both schemes, and the UNFIXED
 * `primary.main` measurably does not (the premise this fix corrects, pinned so a future re-widen of
 * the fill grade is visible here too); (2) rendered — the actual `<Landing/>` resolves each CTA's
 * live `color` to a value that clears the same floor, so a future revert of the `sx` override (not
 * just a token edit) red-builds this file too.
 *
 * GATE Z amendment 7 (design conformance) split `cta-secondary` off from this fix's own mechanism:
 * the design's `.btn.secondary` label is `var(--phosphor)` (the app's `text.primary`), not amber —
 * QA's visual review caught F7c's amber label as a fidelity miss even though it cleared AC-G1.
 * `cta-secondary` now binds `text.primary` (clears 4.5:1 by construction — it IS the body-text
 * colour — with more margin than `textAmber` had); `cta-methodology` and `cta-band-secondary` are
 * UNCHANGED, still `textAmber`, and still exercised exactly as this file always has. The "rendered"
 * test below asserts the SAME 4.5:1 floor for all three regardless of which mechanism clears it, so
 * it stays the correct regression guard for both.
 */
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, type Theme } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { lightTheme } from '@/shared/theme/theme';
import { extras, extrasLight, palette } from '@/shared/theme/tokens';
import { Landing } from './Landing';

// ---- WCAG relative-luminance / contrast, computed IN-SPEC (mirrors text-dim/text-info-contrast) ----
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

/** `getComputedStyle(...).color` returns `rgb(r, g, b)` / `rgba(r, g, b, a)`, never hex. */
const cssColorToRgb = (css: string): Rgb => {
  const m = css.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`Unparseable computed color: "${css}"`);
  const [r, g, b] = m[1].split(',').map((s) => parseFloat(s.trim()));
  return [r, g, b];
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

/** Composite an opaque `overlayHex` at `alpha` over an opaque `surfaceHex` — the hero chip's own
 *  `alpha(primary.main, 0.12)` tint, sat over `background.default`. */
const compositeOver = (surfaceHex: string, overlayHex: string, alpha: number): string => {
  const [sr, sg, sb] = hexToRgb(surfaceHex);
  const [or_, og, ob] = hexToRgb(overlayHex);
  const mix = (o: number, s: number) => Math.round(o * alpha + s * (1 - alpha));
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(mix(or_, sr))}${toHex(mix(og, sg))}${toHex(mix(ob, sb))}`;
};

// Real backgrounds the landing's outlined/text CTAs and the hero chip sit on (measured against the
// running production build, `getComputedStyle`, walking to the nearest opaque ancestor): the hero's
// `cta-secondary` and the honesty section's `cta-methodology` both sit directly on
// `[data-testid="landing"]`'s `background.default`; the CTA band's `cta-band-secondary` sits on the
// band's own `background.paper` panel; the hero chip's tint composites over `background.default` too.
const LIGHT_BG = {
  default: palette.light.background.default,
  paper: palette.light.background.paper,
};
const DARK_BG = { default: palette.dark.background.default, paper: palette.dark.background.paper };

describe('Landing CTA contrast (A11Y-2) — token floor, both schemes', () => {
  it('light: the UNFIXED fill-grade amber measurably fails 4.5:1 on every real CTA/chip background (the premise this fix corrects)', () => {
    expect(contrastOn(palette.light.primary.main, LIGHT_BG.default)).toBeLessThan(4.5);
    expect(contrastOn(palette.light.primary.main, LIGHT_BG.paper)).toBeLessThan(4.5);
    const chipTintUnfixed = compositeOver(LIGHT_BG.default, palette.light.primary.main, 0.12);
    expect(contrastOn(palette.light.primary.main, chipTintUnfixed)).toBeLessThan(4.5);
  });

  it('light: extrasLight.textAmber clears 4.5:1 on every real CTA background', () => {
    expect(contrastOn(extrasLight.textAmber, LIGHT_BG.default)).toBeGreaterThanOrEqual(4.5);
    expect(contrastOn(extrasLight.textAmber, LIGHT_BG.paper)).toBeGreaterThanOrEqual(4.5);
  });

  it("light: extrasLight.textAmber clears 4.5:1 on the hero chip's own composited tint", () => {
    const chipTint = compositeOver(LIGHT_BG.default, palette.light.primary.main, 0.12); // tint stays fill-grade
    expect(contrastOn(extrasLight.textAmber, chipTint)).toBeGreaterThanOrEqual(4.5);
  });

  it('dark: extras.textAmber is byte-identical to primary.main — zero pixel change, and both already clear 4.5:1', () => {
    expect(extras.textAmber).toBe(palette.dark.primary.main);
    expect(contrastOn(extras.textAmber, DARK_BG.default)).toBeGreaterThanOrEqual(4.5);
    expect(contrastOn(extras.textAmber, DARK_BG.paper)).toBeGreaterThanOrEqual(4.5);
  });

  it('contained CTAs (cta-primary, cta-band-primary) are unaffected by this fix and already clear 4.5:1 in both schemes', () => {
    expect(
      contrastOn(palette.light.primary.contrastText, palette.light.primary.main),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastOn(palette.dark.primary.contrastText, palette.dark.primary.main),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('GATE Z amendment 7 — cta-secondary’s new mechanism (text.primary, the design’s phosphor grade) clears 4.5:1 on every real background, both schemes', () => {
    expect(contrastOn(palette.light.text.primary, LIGHT_BG.default)).toBeGreaterThanOrEqual(4.5);
    expect(contrastOn(palette.dark.text.primary, DARK_BG.default)).toBeGreaterThanOrEqual(4.5);
  });
});

function renderLandingIn(activeTheme: Theme) {
  return render(
    <ThemeProvider theme={activeTheme}>
      <CssBaseline />
      <MemoryRouter initialEntries={['/']}>
        <Landing />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('Landing CTA contrast (A11Y-2) — rendered, both schemes', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              authenticated: false,
              user: null,
              google_available: false,
              settings: null,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('light: every outlined/text CTA still bound to textAmber resolves a live `color` that clears 4.5:1 on its real background', () => {
    renderLandingIn(lightTheme);
    const cases: Array<[string, string]> = [
      ['cta-methodology', LIGHT_BG.default],
      ['cta-band-secondary', LIGHT_BG.paper],
    ];
    for (const [testId, bg] of cases) {
      const fg = cssColorToRgb(getComputedStyle(screen.getByTestId(testId)).color);
      expect(contrastRgb(fg, hexToRgb(bg)), testId).toBeGreaterThanOrEqual(4.5);
    }
  });

  // `cta-primary`/`cta-band-primary` (contained) are NOT re-asserted here: MUI's `cssVariables:
  // true` renders their default contrastText as `var(--variant-containedColor)`, which jsdom's
  // `getComputedStyle` does not resolve to an `rgb()` triple (unlike the two literal-hex `sx`
  // overrides above) — the "rendered" proof for the two contained CTAs would test jsdom's variable
  // resolution, not this fix. They are unmodified by this change and already proven by token math
  // above (`palette.light.primary.contrastText` on `palette.light.primary.main`).
  //
  // GATE Z amendment 7 — `cta-secondary` moved OFF this list for the same reason: its new `sx`
  // (`color: 'text.primary'`) is a recognised MUI palette dot-path, so under this app's
  // `cssVariables: true` theme it ALSO resolves to `var(--mui-palette-text-primary)` in jsdom —
  // unlike `extrasFor(theme).textAmber`, which is a plain (non-palette) token and renders as a
  // literal hex. Proven by token math instead, in the describe block above.
});

/**
 * redesign-stage-3 — the amber-spend guards (§8-7 / §8-8 + the §8B-2 ring pins).
 * "Amber SPENT, not sprinkled" is THE grading criterion of the stage; these are the mechanizable
 * halves (the judged halves are the GATE Q render pass R2/R3).
 *
 *   §8-7  textAmber CONTRAST PIN — WCAG ratios computed IN this spec: a future token darken/
 *         lighten below the floor is a red build, not a design opinion.
 *   §8B-2 focus-ring contrast on the FINAL surfaces (ring binds primary.main by construction).
 *   §8-8  textAmber CONSUMPTION — every §5.2 closed-list consumer resolves via `extrasFor(`,
 *         never bare `extras.`.
 *
 * Scans use the Vite `?raw` idiom and are MUTATION-GUARDED (house rule). Comments are stripped
 * where a token may legitimately be MENTIONED as documentation (e.g. a comment naming `extras.`).
 */
import { describe, expect, it } from 'vitest';

import { extras, extrasLight, palette } from './tokens';

const APP_SOURCES = import.meta.glob(['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Strip comments (newline-preserving — the hex-discipline idiom) so documentation mentions of a
 *  token don't count as references. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/(^|[^:'"])\/\/[^\n]*$/gm, '$1');
}

// ---- WCAG luminance/contrast, computed in-spec (§8-7 method) -----------------------------------

const hexRgb = (h: string): number[] =>
  (h.replace('#', '').match(/../g) ?? []).map((x) => parseInt(x, 16));
const chan = (c: number): number => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (h: string): number => {
  const [r, g, b] = hexRgb(h);
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
};
export const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** Composite `fg` at `alpha` over an opaque `bg` (how a tinted chip fill actually renders). */
const composite = (fg: string, alpha: number, bg: string): string => {
  const f = hexRgb(fg);
  const b = hexRgb(bg);
  return (
    '#' +
    f
      .map((v, i) =>
        Math.round(alpha * v + (1 - alpha) * b[i])
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
};

const INK = palette.dark.background.default; //   #0B0F17
const PANEL = palette.dark.background.paper; //   #131A24
const PANEL_RAISED_DARK = extras.panelRaised; //  #1B2432
const PAPER = palette.light.background.default; // #F6F6F3
const WHITE = '#FFFFFF';
const PANEL_RAISED_LIGHT = extrasLight.panelRaised; // #ECECE7
const GAMMA_AMBER = palette.dark.primary.main; // #F2A93B
const AMBER_DEEP = palette.light.primary.main; // #C57F19

describe('§8-7 · textAmber contrast pins (computed, not asserted-by-hand)', () => {
  it('sanity: the contrast helper reproduces the known black/white extremes', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('dark textAmber (=== gammaAmber) is text-class ≥4.5 on ink AND panel', () => {
    expect(extras.textAmber).toBe(GAMMA_AMBER); // dark renders byte-identical
    expect(contrast(extras.textAmber, INK)).toBeGreaterThanOrEqual(4.5); //   measured 9.60
    expect(contrast(extras.textAmber, PANEL)).toBeGreaterThanOrEqual(4.5); // measured 8.76
  });

  it('light textAmber passes the §5.2 HARD gate: ≥4.5 on paper, on white, AND composited over the worst amber tint', () => {
    const t = extrasLight.textAmber;
    expect(contrast(t, PAPER)).toBeGreaterThanOrEqual(4.5); // measured 5.23
    expect(contrast(t, WHITE)).toBeGreaterThanOrEqual(4.5); // measured 5.67
    // The worst tint fill it sits on: alpha(amberDeep, 0.16) over white (the TintChip emphasis
    // tone inside a white light-mode Card). Measured 4.81.
    expect(contrast(t, composite(AMBER_DEEP, 0.16, WHITE))).toBeGreaterThanOrEqual(4.5);
    // And the lighter fills on the closed consumer list (8–12% tints) — all higher, pinned ≥4.5.
    expect(contrast(t, composite(AMBER_DEEP, 0.08, WHITE))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t, composite(AMBER_DEEP, 0.12, WHITE))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t, composite(AMBER_DEEP, 0.08, PAPER))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('§8B-2 · focus-ring contrast on the FINAL surfaces (ring ≡ the mode textAmber — GATE Z B2 ruling)', () => {
  // The B2 finding (light primary.main/amberDeep measured 2.76 on #ECECE7 — below the 3:1 ring
  // floor) was ruled IN-SCOPE and FIXED: the theme-layer ring now binds `extrasFor(theme)
  // .textAmber` in both modes. Dark renders byte-identical (textAmber ≡ gammaAmber ≡
  // primary.main); light gets the ≥3.0-everywhere ring these pins enforce.
  it('dark ring (textAmber ≡ gammaAmber ≡ primary.main) ≥3:1 over ink / panel / panelRaised', () => {
    expect(extras.textAmber).toBe(GAMMA_AMBER); // dark ring is byte-identical to the brand ring
    expect(contrast(extras.textAmber, INK)).toBeGreaterThanOrEqual(3); //               9.60
    expect(contrast(extras.textAmber, PANEL)).toBeGreaterThanOrEqual(3); //             8.76
    expect(contrast(extras.textAmber, PANEL_RAISED_DARK)).toBeGreaterThanOrEqual(3); // 7.82
  });

  it('light ring (textAmber #8F5C0F) ≥3.0 over EVERY light surface it can land on', () => {
    const ring = extrasLight.textAmber;
    expect(contrast(ring, PAPER)).toBeGreaterThanOrEqual(3.0); //              measured 5.23
    expect(contrast(ring, WHITE)).toBeGreaterThanOrEqual(3.0); //              measured 5.67
    expect(contrast(ring, PANEL_RAISED_LIGHT)).toBeGreaterThanOrEqual(3.0); // measured 4.78 (was the 2.76 fail on amberDeep)
    expect(contrast(ring, extrasLight.hatchAlt)).toBeGreaterThanOrEqual(3.0); // measured 4.91
  });

  it("the Widget frame's in-component ring surface still passes: amberDeep ≥3.0 on paper (its only host)", () => {
    // Widget.tsx keeps its accounted in-component `primary.main` ring; widget frames sit on
    // background.default (paper) only — the Stage-1 3.02 re-pinned.
    expect(contrast(AMBER_DEEP, PAPER)).toBeGreaterThanOrEqual(3.0); // measured 3.019
    expect(contrast(AMBER_DEEP, WHITE)).toBeGreaterThanOrEqual(3.0); // measured 3.27
  });
});

// ---- §8-8 · textAmber consumption (structural) ---------------------------------------------------

/** The §5.2 CLOSED consumer list — every site keeping amber text below 18px. */
// (scanner) The `/scanner` coming-soon stub's 11px amber pill and its Ticker link were RETIRED with
// the real Scanner page (Scanner v1 P4). The scan surface's one amber spend is the per-row tier
// chip, which lives in `shared/ui/TintChip.tsx` — already on this list.
// (broker-connect) `positions/LiveTabPanel.tsx` (the LOCKED chip) left this list WITH its file:
// the placeholder was replaced by the real Broker tab, which spends NO amber (steel-outline chip;
// burnt-orange `warning.*` for its S8/unreadable banners only, icon always — the MUI Alert).
const TEXT_AMBER_CONSUMERS = [
  '/src/app/features/auth/SettingsPage.tsx', //                  selected theme-toggle labels
  '/src/app/pages/ticker/widgets/opportunity-tier/OpportunityTier.tsx', // Prime banner body text
  '/src/app/pages/ticker/widgets/ai-rec/StateExportDrawer.tsx', // COPY buttons (11px)
  '/src/app/features/trading/tradeEntry/TradeEntryDialogView.tsx', // provenance chip label (13px)
  '/src/app/shared/ui/TintChip.tsx', //                          the `emphasis` tone text
];

describe('§8-8 · textAmber consumption — the closed list resolves via extrasFor (never bare extras.)', () => {
  const bareExtras = (src: string): boolean =>
    /\bextras\./.test(stripComments(src)) || /\bextrasLight\./.test(stripComments(src));

  it('MUTATION GUARD: bare `extras.` (dark-locked) is flagged; `extrasFor(t).textAmber` is not', () => {
    expect(bareExtras('color: extras.textAmber')).toBe(true);
    expect(bareExtras('color: extrasLight.textAmber')).toBe(true);
    expect(bareExtras('color: extrasFor(t).textAmber')).toBe(false);
  });

  it('every closed-list consumer binds textAmber through extrasFor', () => {
    for (const file of TEXT_AMBER_CONSUMERS) {
      const src = APP_SOURCES[file];
      expect(src, `${file} must exist (consumer list is live)`).toBeTruthy();
      const code = stripComments(src);
      expect(code, `${file}: must resolve via extrasFor(`).toContain('extrasFor(');
      expect(code, `${file}: must bind .textAmber`).toContain('.textAmber');
      expect(bareExtras(src), `${file}: bare extras./extrasLight. dark-locks the surface`).toBe(
        false,
      );
    }
  });
});

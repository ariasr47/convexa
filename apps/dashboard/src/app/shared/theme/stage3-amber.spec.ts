/**
 * redesign-stage-3 — the amber-spend guards (§8-3 / §8-5 / §8-7 / §8-8 + the §8B-2 ring pins).
 * "Amber SPENT, not sprinkled" is THE grading criterion of the stage; these are the mechanizable
 * halves (the judged halves are the GATE Q render pass R2/R3).
 *
 *   §8-7  textAmber CONTRAST PIN — WCAG ratios computed IN this spec: a future token darken/
 *         lighten below the floor is a red build, not a design opinion.
 *   §8B-2 focus-ring contrast on the FINAL surfaces (ring binds primary.main by construction).
 *   §8-5  brandGradient DISPOSITION — token absent, zero references, the gradient-brand pair
 *         unreproducible in features/auth; the avatar renders flat primary slots.
 *   §8-3  amber CENSUS (structural half) — no `primary` inside hover blocks of the named files,
 *         CommandDeck carries zero primary, the remaining MOVE→info sites bind `info`.
 *   §8-8  textAmber CONSUMPTION — every §5.2 closed-list consumer resolves via `extrasFor(`,
 *         never bare `extras.`.
 *
 * Scans use the Vite `?raw` idiom and are MUTATION-GUARDED (house rule). Comments are stripped
 * where a token may legitimately be MENTIONED as documentation (e.g. "brandGradient was deleted").
 */
import Box from '@mui/material/Box';
import { ThemeProvider } from '@mui/material/styles';
import { render } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { AVATAR_SX } from '@/features/auth/avatar';
import { theme } from './theme';
import { extras, extrasLight, palette } from './tokens';

const APP_SOURCES = import.meta.glob(['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Strip comments (newline-preserving — the hex-discipline idiom) so documentation mentions of a
 *  retired token don't count as references. */
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

describe('§8-5 · brandGradient disposition (deleted, both consumers flat)', () => {
  const referencesBrandGradient = (src: string): boolean =>
    /\bbrandGradient\b/.test(stripComments(src));
  const gradientPairInAuth = (src: string): boolean =>
    stripComments(src).includes('linear-gradient(135deg');

  it('MUTATION GUARD: the checkers flag real references and ignore comment mentions', () => {
    expect(referencesBrandGradient(`import { brandGradient } from '@/shared/theme/tokens';`)).toBe(
      true,
    );
    expect(referencesBrandGradient('// brandGradient was deleted here')).toBe(false);
    expect(gradientPairInAuth(`background: 'linear-gradient(135deg, #a, #b)'`)).toBe(true);
  });

  it('zero brandGradient references anywhere (comment mentions stripped)', () => {
    const offenders = Object.entries(APP_SOURCES)
      .filter(([, src]) => referencesBrandGradient(src))
      .map(([f]) => f);
    expect(offenders).toEqual([]);
  });

  it('zero 135deg gradient-brand pairs under features/auth (the pill/avatar cannot regrow one)', () => {
    const offenders = Object.entries(APP_SOURCES)
      .filter(([f]) => f.startsWith('/src/app/features/auth/'))
      .filter(([, src]) => gradientPairInAuth(src))
      .map(([f]) => f);
    expect(offenders).toEqual([]);
  });

  it('the avatar disc renders flat primary.main + primary.contrastText (white-on-amber unreproducible)', () => {
    const { container } = render(
      createElement(
        ThemeProvider,
        { theme },
        createElement(Box, { sx: AVATAR_SX, 'data-testid': 'avatar-probe' } as never, 'R'),
      ),
    );
    const el = container.querySelector('[data-testid="avatar-probe"]') as HTMLElement;
    const cls = Array.from(el.classList).find((c) => c.startsWith('css-'));
    const css = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent ?? '')
      .join('\n')
      .replace(/\s+/g, '');
    const rule = css.split(`.${cls}{`)[1]?.split('}')[0] ?? '';
    // The theme runs cssVariables:true — the slots compile to --mui-palette-* var() refs. Either
    // the var binding or the resolved literal proves the SLOT (never a hardcoded fill).
    expect(rule).toMatch(
      new RegExp(`background-color:(var\\(--mui-palette-primary-main\\)|${GAMMA_AMBER})`),
    );
    expect(rule).toMatch(
      new RegExp(
        `[;{]color:(var\\(--mui-palette-primary-contrastText\\)|${palette.dark.primary.contrastText})`,
      ),
    );
    expect(rule).not.toContain('linear-gradient');
    expect(rule).not.toContain('#fff');
  });

  it('the Sign-up pill is a flat contained-primary button (no gradient, no common.white label)', () => {
    const src = APP_SOURCES['/src/app/features/auth/AccountControl.tsx'];
    expect(src, 'AccountControl.tsx must exist').toBeTruthy();
    const code = stripComments(src);
    expect(code).toContain('variant="contained"');
    expect(code).not.toContain('common.white');
    expect(code).not.toContain('linear-gradient');
  });
});

// ---- §8-3 · the amber census, mechanizable half -------------------------------------------------

/** Balanced-brace extraction of every `'&:hover': { … }` block in a source. */
export function hoverBlocks(src: string): string[] {
  const out: string[] = [];
  const re = /['"]&:hover['"]\s*:\s*\{/g;
  for (const m of src.matchAll(re)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') depth -= 1;
      i += 1;
    }
    out.push(src.slice(start, i - 1));
  }
  return out;
}

const hoverAmber = (src: string): string[] =>
  hoverBlocks(stripComments(src)).filter(
    (b) => b.includes('primary') || b.includes('--mui-palette-primary'),
  );

/** The "no amber on hover chrome" file list (§8-3a — the rule made structural). */
const HOVER_CENSUS_FILES = [
  '/src/app/shared/ui/Widget/Widget.tsx',
  '/src/app/pages/ticker/widgets/_kit/StatTile.tsx',
  '/src/app/features/trading/positions/PositionRow.tsx',
  '/src/app/features/trading/positions/PositionCard.tsx',
  '/src/app/features/trading/orders/OrderRow.tsx',
  '/src/app/features/trading/positions/PositionsView.tsx',
];

/** The MOVE→info sites (§4 lists; the /scanner stub's link retired with the real page at P4): marker → the window that must bind `info`, not `primary`. */
const MOVE_TO_INFO_SITES: Array<{ file: string; marker: string; window: 'after' | 'before' }> = [
  {
    file: '/src/app/pages/ticker/widgets/ai-rec/AiRecPanel.tsx',
    marker: 'onViewExport(readPersonaIdForRequest)',
    window: 'after',
  },
  {
    file: '/src/app/features/trading/orders/OrdersWidget.tsx',
    marker: '{ACTION_ALL_ORDERS}',
    window: 'before',
  },
  {
    file: '/src/app/features/trading/positions/CustomizationToolbar.tsx',
    marker: 'data-testid="history-button"',
    window: 'after',
  },
  {
    file: '/src/app/features/trading/positions/PositionsView.tsx',
    marker: 'const clearLinkSx',
    window: 'after',
  },
  {
    file: '/src/app/features/trading/positions/PositionRow.tsx',
    marker: 'data-testid="position-view-order"',
    window: 'after',
  },
];

const WINDOW = 700;
function siteWindow(src: string, marker: string, dir: 'after' | 'before'): string | null {
  const i = src.indexOf(marker);
  if (i < 0) return null;
  return dir === 'after'
    ? src.slice(i, i + marker.length + WINDOW)
    : src.slice(Math.max(0, i - WINDOW), i + marker.length);
}

describe('§8-3 · amber census — hover chrome, deck, and the MOVE→info sites (mutation-guarded)', () => {
  it('MUTATION GUARD: the hover extractor finds nested blocks and flags amber inside them', () => {
    const fixture = `sx={{ '&:hover': { borderColor: theme.palette.primary.main, '& .x': { opacity: 1 } } }}`;
    expect(hoverBlocks(fixture)).toHaveLength(1);
    expect(hoverAmber(fixture)).toHaveLength(1);
    expect(hoverAmber(`sx={{ '&:hover': { borderColor: theme.palette.text.disabled } }}`)).toEqual(
      [],
    );
    expect(
      hoverAmber(
        `'&:hover': { borderColor: 'color-mix(in srgb, var(--mui-palette-primary-main) 40%, x)' }`,
      ),
    ).toHaveLength(1);
  });

  it('(a) NO primary token inside any &:hover block of the census files (hover chrome is neutral)', () => {
    for (const file of HOVER_CENSUS_FILES) {
      const src = APP_SOURCES[file];
      expect(src, `${file} must exist (census list is live)`).toBeTruthy();
      expect(hoverAmber(src), `${file}: amber must not land on hover chrome`).toEqual([]);
    }
  });

  it('(b) CommandDeck contains ZERO primary references — the washes are gone, the deck has no legitimate amber', () => {
    const deck = APP_SOURCES['/src/app/pages/ticker/widgets/chrome/CommandDeck.tsx'];
    expect(deck, 'CommandDeck.tsx must exist').toBeTruthy();
    expect(stripComments(deck)).not.toMatch(/primary/);
  });

  it('(c) the MOVE→info sites bind `info`, not `primary` (link-class text is signal-blue)', () => {
    for (const { file, marker, window } of MOVE_TO_INFO_SITES) {
      const src = APP_SOURCES[file];
      expect(src, `${file} must exist`).toBeTruthy();
      const win = siteWindow(src, marker, window);
      expect(win, `${file}: marker "${marker}" must exist (site list is live)`).toBeTruthy();
      expect(win, `${file} @ "${marker}": must bind info.main`).toContain('info.main');
      expect(win, `${file} @ "${marker}": must not bind primary.main`).not.toContain(
        'primary.main',
      );
    }
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

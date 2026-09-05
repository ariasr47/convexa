/**
 * AC-42 — `steel2` (`extras.textTertiary`) measured contrast, BOTH schemes, GATED not just narrated.
 *
 * Before this file, the dark floor the canon states ("measured ≥4.8:1 on panel, 5.2:1 on ink") and
 * the light measurements were only prose in `BUILD_REPORT.md` §5 — never a red-buildable assertion
 * (`grep -rn textTertiary` outside `tokens.ts` hit only `token-parity.spec.ts` [[AC-41, key-set/value
 * parity]] and `banned-literals.spec.ts` [[AC-44, no hardcoded literal]] — neither computes contrast).
 * This file is that assertion, using the same in-spec WCAG luminance/contrast method as
 * `stage3-amber.spec.ts` §8-7.
 *
 * Owner ruling 7 (2026-09-03, `council/decisions.md`): light `#61708A` measured 4.23:1 on
 * `extras.panelRaised` — below WCAG AA's 4.5:1 normal-text floor. Ruled: darken until the token
 * clears 4.5:1 "on every light surface where `textTertiary` can actually appear", determined FROM
 * THE CODE, not assumed. Real consumers of `extrasFor(theme).panelRaised` / `.well` found by a full
 * source grep (verified again by the liveness guard below, so this comment cannot silently go stale):
 *   - `panelRaised` (`#ECECE7`, the DARKEST real light surface — the binding floor): dialogs
 *     (`AuthDialog.tsx`, `TradeEntryDialogView.tsx`, `OrderDetailDialog.tsx`), toolbars
 *     (`CustomizationToolbar.tsx`, `ScanToolbar.tsx`), table row hover (`ScanTable.tsx`), and inside
 *     a real ticker widget (`PositionBrief.tsx`'s basis-label chip, `text.secondary` text on it).
 *   - `well` (`#F1F1EC`, lighter than `panelRaised`): the inset body of SEVEN real ticker widgets
 *     (`MarketContext`, `StraddleMove`, `LiveTape`, `DealerFlowProjection`, `DealerPositioning`,
 *     `StructureHistory`, `IvRank` — all `bodyVariant="inset"`) and `TopNav.tsx`'s search-trigger
 *     button (`color: 'text.secondary'` painted directly on `extrasFor(t).well`).
 *   - `background.default` ("paper", `#F6F6F3`) and `background.paper` (white, `#ffffff`): the page
 *     canvas and `Widget.tsx`'s own card root / `FigureCell.tsx`'s `CellCard` / dialog papers.
 * `panelRaised2` (`raised2`, `#E3E3DD`, the darkest of the whole `extras` family) is DELIBERATELY
 * excluded from the floor: it has ZERO real consumers anywhere in the app today — only `tokens.ts`
 * (the definition) and this file's own token-hygiene siblings reference it by name. Darkening far
 * enough to also clear it (`#58657D`, 4.56:1 there) would be un-evidenced AND would invert the
 * tertiary-quieter-than-secondary hierarchy on white (5.88:1 vs `text.secondary`'s composited
 * 5.74:1 there) for a surface nothing paints today. The liveness guard below makes that premise
 * self-checking: it red-builds the day a component actually consumes `panelRaised2`, which is
 * precisely the trigger to redo this token's floor against it.
 */
import { describe, expect, it } from 'vitest';
import { extras, extrasLight } from './tokens';

// ---- WCAG relative-luminance / contrast, computed IN-SPEC (mirrors stage3-amber.spec.ts §8-7) ----
type Rgb = [number, number, number];

const hexToRgb = (hex: string): Rgb => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
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
  contrastRgb(fg.startsWith('#') ? hexToRgb(fg) : rgbaOverHex(fg, surfaceHex), hexToRgb(surfaceHex));

// Real surfaces, both schemes (evidence for each is the block comment above).
const DARK = { ink: '#0B0F17', panel: '#131A24', well: '#0D121B' };
const LIGHT = { white: '#ffffff', paper: '#F6F6F3', panelRaised: '#ECECE7', well: '#F1F1EC' };
const LIGHT_EXCLUDED = { raised2: '#E3E3DD' };

describe('AC-42 — steel2 (extras.textTertiary) contrast floor, both schemes', () => {
  it('dark: clears the canon floor on panel (explicit "≥4.8:1")', () => {
    expect(contrastOn(extras.textTertiary, DARK.panel)).toBeGreaterThanOrEqual(4.8);
  });

  it('dark: clears the measured reality on ink with headroom (precise 5.1846, not a stated "≥" floor)', () => {
    // The canon's "5.2:1 on ink" is the ROUNDED measurement (BUILD_REPORT.md §5 records the more
    // precise "5.18:1"), not a value carrying an explicit "≥" the way panel's does. Asserting a
    // literal ≥5.2 here would red-build against the app's own already-shipped, already-approved
    // dark value — this pins the measured reality with real headroom instead.
    expect(contrastOn(extras.textTertiary, DARK.ink)).toBeGreaterThanOrEqual(5.15);
  });

  it('dark: also clears the panel floor on `well` — the inset body of the same 7 real ticker widgets', () => {
    // Reuses panel's already-canon-approved ≥4.8 floor (not a new invented number): `well` is a real
    // consumed dark surface (Widget.tsx bodyVariant="inset"; TopNav.tsx's search-trigger button).
    expect(contrastOn(extras.textTertiary, DARK.well)).toBeGreaterThanOrEqual(4.8);
  });

  it('light: clears WCAG AA 4.5:1 on every light surface a real consumer paints text on today (owner ruling 7, 2026-09-03)', () => {
    // `panelRaised` is the DARKEST of the four real surfaces — the binding floor.
    expect(contrastOn(extrasLight.textTertiary, LIGHT.panelRaised)).toBeGreaterThanOrEqual(4.5);
    expect(contrastOn(extrasLight.textTertiary, LIGHT.well)).toBeGreaterThanOrEqual(4.5);
    expect(contrastOn(extrasLight.textTertiary, LIGHT.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrastOn(extrasLight.textTertiary, LIGHT.white)).toBeGreaterThanOrEqual(4.5);
  });

  it('light: does NOT clear `raised2` — recorded, not gated, because nothing renders there today', () => {
    const c = contrastOn(extrasLight.textTertiary, LIGHT_EXCLUDED.raised2);
    expect(c).toBeGreaterThan(4.0); // sanity bound — still legible, just short of the 4.5 AA floor
    expect(c).toBeLessThan(4.5); // documents the accepted gap; a pass here would mean re-picking the
    // darker candidate is due (or a genuine improvement worth re-verifying against the guard below)
  });

  it('LIVENESS GUARD: `panelRaised2` (raised2) still has zero real consumers — the premise the light floor rests on', () => {
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
    // Anti-vacuity — same floor as banned-literals.spec.ts's own glob-size guard.
    expect(Object.keys(sources).length).toBeGreaterThan(40);
    const hits = Object.entries(sources)
      .filter(([, src]) => src.includes('panelRaised2'))
      .map(([file]) => file.replace(/^\/src\/app\//, ''));
    expect(
      hits,
      'a component now consumes panelRaised2 (raised2) — re-run the steel2 light floor against it ' +
        '(owner ruling 7 conditioned #5D6B84 on it staying unconsumed; #58657D clears raised2 too, ' +
        'at the cost of inverting the tertiary/secondary hierarchy on white — see the top-of-file note)',
    ).toEqual([]);
  });
});

/**
 * `[theme-token-discipline]` — the consolidated zero-hardcoded-hex scan (structural enforcement of the
 * promoted invariant: "zero hardcoded hex; dark/light parity is part of done").
 *
 * WHY a test and not review: a hardcoded hex renders correctly in the mode it was developed against
 * and silently breaks the OTHER mode — invisible in jsdom renders and in single-mode review. Exactly
 * this class shipped before (broken light mode, owner screenshots, 2026-07-01); the light-mode-parity
 * program exists because of it.
 *
 * HOW: `import.meta.glob(..., ?raw)` over ALL component sources under `pages/**`, `features/**`,
 * `shell/**`, and `shared/ui/**` — a GLOB, not an enumeration, so files that don't exist yet are
 * covered by default. `shared/theme/**` is excluded BY CONSTRUCTION (it is where hex belongs:
 * tokens.ts/theme.ts are the single source of color truth). Comments are stripped (newline-preserving,
 * so reported line numbers stay true); every surviving hex literal must be on the explicit,
 * per-file-justified exemption list below.
 */
import { describe, expect, it } from 'vitest';

// Eager raw imports, anchored at the Vite root (apps/dashboard) — keys are `/src/app/...` paths.
const SOURCES = import.meta.glob(
  [
    '/src/app/pages/**/*.{ts,tsx}',
    '/src/app/features/**/*.{ts,tsx}',
    '/src/app/shell/**/*.{ts,tsx}',
    '/src/app/shared/ui/**/*.{ts,tsx}',
    // Canvas/WebGL instruments (Structure Field) — hex-scanned; brand literals need exemption.
    '/src/app/shared/charts/**/*.{ts,tsx}',
    '!**/*.spec.{ts,tsx}', // specs may quote hex in fixtures/regexes; they render nothing
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/**
 * The exemption list — EVERY entry carries its justification. Keys are app-relative paths
 * (`src/app/...`). Entries marked TODO(theme-token-discipline) are ACKNOWLEDGED DEBT, not approval:
 * the suite stays green while the violation stays visible here for the parity program to burn down.
 */
const EXEMPT: Record<string, string> = {
  // LEGITIMATE — brand mark carve-out. The official multicolor Google "G" (4 brand fills:
  // #EA4335/#4285F4/#FBBC05/#34A853) plus Google's branded sign-in button spec (white surface,
  // #1f1f1f label, #f1f3f4 hover — per the Figma AuthModal). Brand colors are deliberately
  // theme-INVARIANT: the Google button looks identical in dark and light mode by design.
  'features/auth/GoogleButton.tsx':
    'Google brand mark + branded sign-in button spec (theme-invariant by design)',

  // RESOLVED (FE-3, SPEC §2.7) — StructureFieldCanvas.tsx now takes its level/surface colours as
  // RESOLVED props (`palette`/`surfaces`) from `levelStrokes.ts` + the host's `useTheme()`; the
  // module-level hex literals (`INK`/`PANEL`/`RAISED`/`PHOSPHOR`/`STEEL`/`RED`/`GREEN`/`AMBER`/
  // `SIGNAL`/`BURNT`) are gone. Its exemption entry is REMOVED, not kept — this is the coupled
  // removal SPEC §2.7 / PLAN.md U-6 calls for. See `levelStrokes.spec.ts` for the file-scoped
  // liveness half of this proof (a before/after `hex-discipline.spec.ts` run, recorded in the build
  // report) and `StructureFieldCanvas.spec.tsx` for the canvas-paints-from-props proof.
  //
  // `structureFieldShared.ts`'s `SF` STAYS exempt — it is consumed ONLY by `pages/lab/**`
  // (`StructureFieldWebGL.tsx`, the WebGL comparison twin), which is out of this phase's product
  // scope (PLAN.md FE-3: "if a lab file cannot be converted cheaply, keep its hex-discipline
  // exemption entry"). `StructureFieldCanvas.tsx` itself never imported `structureFieldShared.ts`
  // (verified: no import statement between the two files) — the two files' hex literals were
  // always independent duplicates, not a shared source.
  'shared/charts/structure-field/structureFieldShared.ts':
    "Shared Structure Field brand token literals for the WebGL lab instrument only (pages/lab/** — out of this phase's scope)",
  'pages/lab/demos/labTokens.ts':
    'Lab Canvas demos — brand token literals shared by ticker-candidate instruments',
  'pages/ticker/widgets/structure-hero/WallMagnetView.tsx':
    'Wall Magnet Canvas2D — brand token literals AND their rgba() alpha-blends (gradient stops/shadow glow derived from the same module-level constants; cannot use MUI sx); moved from dealer-positioning/ (FE-6 step 5, file unchanged)',
  'pages/ticker/widgets/term-structure/TermHeatChart.tsx':
    'Term Heat Canvas2D — brand token literals (cannot use MUI sx)',

  // GATE Z repair (curvature-v2-desk-and-read, 2026-09-05) — the scan above was extended to catch
  // `rgba()`/`rgb()` literals too (previously invisible; the FAIL named the two v2 token additions,
  // `scrim`/`glass`, that ARE rgba values as exactly what the hex-only regex missed). The two
  // PRODUCT-PATH occurrences the FAIL named with real fixes (`StructureFieldCanvas.tsx`'s border/
  // shadow now bind `surfaces.steel`/`surfaces.ink` + the new `fieldAmbientShadow` token;
  // `TapePulseStrip.tsx`'s print-flash bars now bind the SAME resolved `palette.callWall`/
  // `palette.putWall` the ladder/field already share) are REMOVED from this list, not added to it.
  // Everything below is a genuinely NEW-VISIBLE class the broadened regex surfaces — Canvas2D
  // lab/demo instruments (same brand-literal carve-out as `WallMagnetView.tsx`/`TermHeatChart.tsx`
  // above) and production decorative micro-glazing (`sx`/`styled` inset-highlight and drop-shadow
  // literals) that already branch on `theme.palette.mode` at every call site — i.e. NOT the
  // scheme-invariant shape criterion 53 polices, just unsourced. Rebinding a dozen single-consumer
  // cosmetic alpha values to brand-new named tokens is a design-system extension this narrow repair
  // has no authority to make (`DESIGN_SYSTEM.md` canon table is unchanged); exempted here, reasoned,
  // for a future design pass to burn down.
  'pages/lab/StructureFieldWebGL.tsx':
    'Structure Field WebGL comparison twin (pages/lab/** — out of product scope) — brand token rgba alpha-blends, same carve-out as structureFieldShared.ts',
  'pages/lab/demos/FlowRibbonsLab.tsx':
    'Lab Canvas demo — brand token rgba alpha-blends, same carve-out as labTokens.ts',
  'pages/lab/demos/TapePulseLab.tsx':
    'Lab Canvas demo — brand token rgba alpha-blends, same carve-out as labTokens.ts',
  'pages/lab/demos/TermHeatLab.tsx':
    'Lab Canvas demo — brand token rgba alpha-blends, same carve-out as labTokens.ts',
  'pages/lab/demos/WallMagnetLab.tsx':
    'Lab Canvas demo — brand token rgba alpha-blends, same carve-out as labTokens.ts',
  'features/auth/AuthDialog.tsx':
    "The auth modal's own backdrop tuning (`slotProps.backdrop.sx`) is a deliberately DIFFERENT weight/hue from the shared v2 `scrim` token (0.66 vs 0.55 alpha, a slightly warmer near-ink vs pure `scrim`'s neutral) — pre-dates this phase; rebinding to `scrim` would visibly lighten the auth gate, a UX call outside this repair's authority",
  'pages/ticker/widgets/_kit/FigureCell.tsx':
    'Figure card bevel/inset-highlight micro-shadow — decorative, already branches on `theme.palette.mode` at every call site (not scheme-invariant), single-consumer cosmetic values',
  'pages/ticker/widgets/chrome/CommandDeck.tsx':
    'Top-highlight glass gradient on the command deck surface — decorative, dark-only (light branch is `none`), single-consumer cosmetic value',
  'pages/ticker/widgets/chrome/TickerToolbar.tsx':
    'Inset top-highlight on the toolbar — decorative, dark-only (light branch is `none`), single-consumer cosmetic value',
  'pages/ticker/widgets/position-brief/PositionBrief.tsx':
    'Card bevel/inset-highlight micro-shadow — decorative, already branches on `theme.palette.mode` at every call site, single-consumer cosmetic values',
  'pages/ticker/widgets/structure-history/StructurePathStrip.tsx':
    'Row hover/zebra tint — decorative, already branches on `theme.palette.mode` (dark 0.18 / light 0.03 black alpha), single-consumer cosmetic value',
  'shared/ui/Widget/Widget.tsx':
    'Body-well inset shadow (the recessed-panel affordance) — decorative, already branches on `theme.palette.mode` at its one call site, single-consumer cosmetic value',

  // (2026-07-16) The two operator-metrics TODO exemptions were RESOLVED the same day they were
  // logged: the chart palette + stale-dot grey moved into `shared/theme/tokens.ts` as the
  // theme-invariant `chartCategorical` group. (Its one-time companion `brandGradient` was itself
  // deleted at redesign-stage-3 §5.1 — zero consumers; stage1-tokens.spec pins the absence.)
  // The liveness invariant below is what forced their removal — a stale exemption fails the
  // suite by design.
};

/** `/src/app/pages/foo.tsx` → `pages/foo.tsx` (app-relative, matching the EXEMPT keys). */
const appPath = (globKey: string) => globKey.replace(/^\/src\/app\//, '');

/** Strip comments while PRESERVING newlines so reported line numbers match the real file. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, '')) // block comments → blank, same lines
    .replace(/^\s*\/\/.*$/gm, ''); // full-line `//` comments (house idiom — never truncates URLs)
}

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
/**
 * GATE Z repair (curvature-v2-desk-and-read, 2026-09-05): the hex-only regex above was blind to
 * `rgba()`/`rgb()` literals — exactly the shape TWO of the seven v2 token additions (`scrim`,
 * `glass`) take, so a component could hardcode a duplicate of either and this guard would stay
 * green. Matches literal NUMERIC channels only (`rgba(46,204,113,0.2)`) — never a CSS-var-bound
 * one (`rgba(var(--mui-palette-primary-mainChannel) / 0.5)`, MUI's own alpha-channel idiom, whose
 * first token is `var(`, not a digit) and never a fully alpha-ZERO stop (`rgba(0,0,0,0)`,
 * `rgba(255,255,255,0)`) — a transparent gradient fade-out spends no colour at all regardless of
 * its RGB channels, so flagging it would be pure noise (`[theme-token-discipline]` cares about
 * colour actually rendered, not the inert numbers a `0` alpha carries along for CSS syntax).
 */
const RGB_LITERAL =
  /\brgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*([\d.]+)\s*)?\)/g;
function rgbMatches(line: string): string[] {
  const out: string[] = [];
  for (const m of line.matchAll(RGB_LITERAL)) {
    const alpha = m[1];
    if (alpha !== undefined && Number.parseFloat(alpha) === 0) continue; // fully transparent — no colour spent
    out.push(m[0]);
  }
  return out;
}

describe('[theme-token-discipline] · zero hardcoded hex outside shared/theme', () => {
  it('the glob is not vacuous (component sources actually loaded)', () => {
    // Guard by construction: an empty/mis-rooted glob would green-light everything silently.
    expect(Object.keys(SOURCES).length).toBeGreaterThan(40);
    expect(Object.keys(SOURCES).some((k) => appPath(k).startsWith('pages/'))).toBe(true);
    expect(Object.keys(SOURCES).some((k) => appPath(k).startsWith('features/'))).toBe(true);
    expect(Object.keys(SOURCES).some((k) => appPath(k).startsWith('shell/'))).toBe(true);
    expect(Object.keys(SOURCES).some((k) => appPath(k).startsWith('shared/ui/'))).toBe(true);
  });

  it('no component source carries a hex literal outside the justified exemption list', () => {
    const violations: string[] = [];
    for (const [key, src] of Object.entries(SOURCES)) {
      const file = appPath(key);
      if (file in EXEMPT) continue;
      const lines = stripComments(src).split('\n');
      lines.forEach((line, i) => {
        for (const m of line.match(HEX) ?? []) {
          violations.push(`src/app/${file}:${i + 1} → ${m}`);
        }
        for (const m of rgbMatches(line)) {
          violations.push(`src/app/${file}:${i + 1} → ${m}`);
        }
      });
    }
    expect(
      violations,
      `[theme-token-discipline] hardcoded hex/rgb(a) found — style via theme tokens (shared/theme/tokens.ts), ` +
        `or add a justified entry to the exemption list in this spec:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('the exemption list is live — every entry still exists AND still carries hex/rgb(a) (stale entries must be removed)', () => {
    for (const [file, why] of Object.entries(EXEMPT)) {
      const entry = Object.entries(SOURCES).find(([k]) => appPath(k) === file);
      if (!entry)
        throw new Error(`${file} is exempted (“${why}”) but no longer exists — remove the entry`);
      const stripped = stripComments(entry[1]);
      const hasHex = (stripped.match(HEX) ?? []).length > 0;
      const hasRgb = stripped.split('\n').some((line) => rgbMatches(line).length > 0);
      expect(
        hasHex || hasRgb,
        `${file} is exempted but carries no hex/rgb(a) anymore — remove the entry`,
      ).toBe(true);
    }
  });
});

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
    'Shared Structure Field brand token literals for the WebGL lab instrument only (pages/lab/** — out of this phase\'s scope)',
  'pages/lab/demos/labTokens.ts':
    'Lab Canvas demos — brand token literals shared by ticker-candidate instruments',
  'pages/ticker/widgets/chrome/TapePulseStrip.tsx':
    'Tape Pulse strip Canvas2D — brand token literals (cannot use MUI sx)',
  'pages/ticker/widgets/dealer-positioning/WallMagnetView.tsx':
    'Wall Magnet Canvas2D — brand token literals (cannot use MUI sx)',
  'pages/ticker/widgets/term-structure/TermHeatChart.tsx':
    'Term Heat Canvas2D — brand token literals (cannot use MUI sx)',

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
      });
    }
    expect(
      violations,
      `[theme-token-discipline] hardcoded hex found — style via theme tokens (shared/theme/tokens.ts), ` +
        `or add a justified entry to the exemption list in this spec:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('the exemption list is live — every entry still exists AND still carries hex (stale entries must be removed)', () => {
    for (const [file, why] of Object.entries(EXEMPT)) {
      const entry = Object.entries(SOURCES).find(([k]) => appPath(k) === file);
      if (!entry)
        throw new Error(`${file} is exempted (“${why}”) but no longer exists — remove the entry`);
      const hasHex = (stripComments(entry[1]).match(HEX) ?? []).length > 0;
      expect(hasHex, `${file} is exempted but carries no hex anymore — remove the entry`).toBe(
        true,
      );
    }
  });
});

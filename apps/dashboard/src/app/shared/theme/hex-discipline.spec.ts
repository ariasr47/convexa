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
  // REMOVED (owner, 2026-10-14): the Lab and its exemptions (`structureFieldShared.ts`'s `SF`,
  // `labTokens.ts`, `StructureFieldWebGL.tsx` and the four Canvas demos) went with the Lab itself.
  // REMOVED (structure-hero repair task item 10, 2026-09-08): `WallMagnetView.tsx` now takes
  // `palette`/`surfaces` as RESOLVED props (the SAME objects `StructureFieldCanvas`/`LevelLadder`/
  // `TapePulseStrip` already receive from `StructureHeroPanel`, criterion 7) in place of its own
  // module-level `INK`/`PANEL`/`PHOSPHOR`/`STEEL`/`AMBER`/`SIGNAL`/`GREEN`/`RED` hex literals — the
  // coupled removal `hex-discipline.spec.ts`'s "the exemption list is live" check requires (a
  // stale entry with no remaining hex/rgb(a) would fail that check on its own).
  //
  // REMOVED (ticker fidelity repair, change 5 / F9, 2026-09-08): `TermHeatChart.tsx` now resolves
  // its INK/PANEL/PHOSPHOR/STEEL/heat/line colours from `useTheme()` (`theme.palette.*`, the SAME
  // resolved-at-JS-access-time values `levelStrokes.ts`'s `resolveToken` already relies on under
  // `cssVariables:true` — a Canvas 2D `fillStyle` cannot resolve a `var(--mui-palette-*)` string,
  // so these are read from the theme OBJECT, never emitted as CSS) in place of its own module-level
  // `INK`/`PANEL`/`PHOSPHOR`/`STEEL`/`GREEN`/`RED`/`SIGNAL` hex literals — the same coupled removal
  // as `WallMagnetView.tsx` above. The IV line is `info.main` (signal) always, never a green/red
  // split; the heat gradient uses `success.main`/`error.main` (the theme's direction pair) only for
  // the two SIGNED states (contango/backwardation) and a neutral `text.secondary` tint for `flat`.

  // GATE Z repair (curvature-v2-desk-and-read, 2026-09-05) — the scan above was extended to catch
  // `rgba()`/`rgb()` literals too (previously invisible; the FAIL named the two v2 token additions,
  // `scrim`/`glass`, that ARE rgba values as exactly what the hex-only regex missed). The two
  // PRODUCT-PATH occurrences the FAIL named with real fixes (`StructureFieldCanvas.tsx`'s border/
  // shadow now bind `surfaces.steel`/`surfaces.ink` + the new `fieldAmbientShadow` token;
  // `TapePulseStrip.tsx`'s print-flash bars now bind the SAME resolved `palette.callWall`/
  // `palette.putWall` the ladder/field already share) are REMOVED from this list, not added to it.
  // Everything below is a genuinely NEW-VISIBLE class the broadened regex surfaces — Canvas2D
  // lab/demo instruments (same brand-literal carve-out as `WallMagnetView.tsx`/`TermHeatChart.tsx`
  // above) are still whole-file (they spend brand rgba alpha-blends throughout, not at named
  // spots). The SEVEN production-file entries this repair originally added here were WHOLE-FILE
  // too — GATE Z narrowed all seven to `EXEMPT_VALUES` below (see that block's header) because a
  // whole-file exemption disarms the guard on any FUTURE hardcoded colour in the same file, not
  // just the value it was granted for (QA F2, 2026-09-05: `outlineColor: '#F2A93B'` injected into
  // `FigureCell.tsx` left this suite at exit 0).

  // (2026-07-16) The two operator-metrics TODO exemptions were RESOLVED the same day they were
  // logged: the chart palette + stale-dot grey moved into `shared/theme/tokens.ts` as the
  // theme-invariant `chartCategorical` group. (Its one-time companion `brandGradient` was itself
  // deleted at redesign-stage-3 §5.1 — zero consumers; stage1-tokens.spec pins the absence.)
  // The liveness invariant below is what forced their removal — a stale exemption fails the
  // suite by design.
};

/**
 * GATE Z narrowing (curvature-v2-desk-and-read, 2026-09-05, QA F2) — the seven product files below
 * were WHOLE-FILE exempted by the prior repair. QA proved the structural cost by mutation: injecting
 * `outlineColor: '#F2A93B'` (a hardcoded brand hex, unrelated to any of the values below) into
 * `FigureCell.tsx` left `hex-discipline.spec.ts` at exit 0 — the guard's coverage on all seven files
 * had gone from full to zero, not just for the values each entry was granted for.
 *
 * Each entry now lists the EXACT literal string(s) (as they appear post-comment-strip, byte for
 * byte) the reason justifies. Any hex/rgb(a) literal in one of these files that is NOT in its
 * `values` list still reds — an unrelated hardcoded colour added to the same file (the
 * `outlineColor: '#F2A93B'` shape QA probed) is caught. The liveness test below still asserts every
 * listed value is still present verbatim, so a stale entry (the value was removed/changed) still
 * reds too — the over-removal-detection property QA confirmed holds.
 *
 * Two reasons here were corrected because QA found them inaccurate (a false reason in an exemption
 * list is the prose-standing-in-for-enforcement failure this program exists to remove):
 *   - `StructurePathStrip` — it is the static container `bgcolor` on the whole strip, not a
 *     "row hover/zebra tint".
 *   - `FigureCell` line 84 — it is a `backgroundImage` sheen, and it is a DRIFTED near-duplicate of
 *     the design mirror's declared `sheen.dark` (`design/tokens/tokens.json`: 0.045 alpha, same 46%
 *     stop; this file carries 0.05). It is NOT bound to a live token here: `sheen` has no export in
 *     `shared/theme/tokens.ts` today (it exists only in the mirror — a PRE-EXISTING, opposite-
 *     direction mirror hole per QA F3(b), not this repair's doing), so there is nothing importable
 *     to bind to, and correcting the literal from 0.05 to 0.045 would itself be a (tiny) rendered
 *     pixel change this narrow repair has no product-design authority to make silently. Left as a
 *     literal, reasoned accurately, for a future design pass that also closes the `sheen` mirror
 *     hole to burn down together.
 *   - `TickerToolbar` — its value is VERBATIM the inset layer of `elevation.dark.e1`
 *     (`inset 0 1px 0 rgba(255, 255, 255, 0.04)`), not an independent decorative choice. It is not
 *     bound to `elevationFor(theme).e1` because that token's box-shadow also carries e1's two OUTER
 *     shadow layers, which the toolbar does not paint today — binding would add visible drop-shadow
 *     layers to the toolbar, a rendered pixel change. Kept as a literal that happens to equal e1's
 *     inset component, reasoned accurately.
 */
const EXEMPT_VALUES: Record<string, { values: string[]; why: string }> = {
  'features/auth/AuthDialog.tsx': {
    values: ['rgba(8, 11, 16, 0.66)'],
    why: "The auth modal's own backdrop tuning (`slotProps.backdrop.sx`) is a deliberately DIFFERENT weight/hue from the shared v2 `scrim` token (0.66 vs 0.55 alpha, a slightly cooler near-ink vs pure `scrim`'s neutral — corrected from 'warmer', QA F2) — pre-dates this phase (byte-identical on origin/main); rebinding to `scrim` would visibly lighten the auth gate, a UX call outside this repair's authority",
  },
  'pages/ticker/widgets/_kit/FigureCell.tsx': {
    values: [
      'rgba(255,255,255,0.05)',
      'rgba(0,0,0,0.35)',
      'rgba(16,24,40,0.08)',
      'rgba(0,0,0,0.6)',
      'rgba(255,255,255,0.08)',
      'rgba(16,24,40,0.25)',
    ],
    why: "Figure card bevel/inset-highlight/drop-shadow micro-shadows — decorative, all mode-branched at their call sites (not scheme-invariant), single-consumer cosmetic values. Line 84's `backgroundImage` sheen (`rgba(255,255,255,0.05)` at a 46% stop) is a DRIFTED near-duplicate of the mirror's declared `sheen.dark` (0.045, same 46% stop) — not bound because `sheen` has no `tokens.ts` export to bind to (pre-existing mirror-only hole) and correcting the literal would itself change rendered pixels; see the block header above",
  },
  'pages/ticker/widgets/chrome/CommandDeck.tsx': {
    values: ['rgba(255,255,255,0.05)'],
    why: 'Top-highlight glass gradient on the command deck surface — decorative, dark-only (light branch is `none`), single-consumer cosmetic value (two occurrences, same value)',
  },
  'pages/ticker/widgets/chrome/TickerToolbar.tsx': {
    values: ['rgba(255,255,255,0.04)'],
    why: "Inset top-highlight on the toolbar, dark-only (light branch is `none`) — VERBATIM the inset layer of `elevation.dark.e1`, not bound to `elevationFor(theme).e1` because that would also add e1's two outer shadow layers (a rendered pixel change the toolbar does not paint today); see the block header above",
  },
  'pages/ticker/widgets/position-brief/PositionBrief.tsx': {
    values: ['rgba(255,255,255,0.04)', 'rgba(16,24,40,0.06)'],
    why: 'Card bevel/inset-highlight micro-shadow — decorative, already branches on `theme.palette.mode` at every call site, single-consumer cosmetic values',
  },
  // REMOVED (structure-hero repair task item 8, 2026-09-08): `StructurePathStrip.tsx` lost its own
  // `bgcolor` — it is a flat row with a top hairline now, matching the tape row above it — so the
  // two mode-branched black-alpha literals this entry exempted are gone, not merely un-exempted.
  'shared/ui/Widget/Widget.tsx': {
    values: ['rgba(0,0,0,0.55)', 'rgba(16,24,40,0.25)'],
    why: 'Body-well inset shadow (the recessed-panel affordance) — decorative, mode-branched at its one call site, single-consumer cosmetic value',
  },
  // REMOVED (owner, 2026-10-14): the field canvas's ambient shadow literal painted only in the Lab's
  // form, which went with the Lab.
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
const RGB_LITERAL = /\brgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*([\d.]+)\s*)?\)/g;
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
      // Per-value exemption (GATE Z, QA F2): only the EXACT literals granted are skipped — any
      // other hex/rgb(a) in the same file (e.g. an injected `outlineColor: '#F2A93B'`) still reds.
      const allowed = new Set(EXEMPT_VALUES[file]?.values ?? []);
      const lines = stripComments(src).split('\n');
      lines.forEach((line, i) => {
        for (const m of line.match(HEX) ?? []) {
          if (allowed.has(m)) continue;
          violations.push(`src/app/${file}:${i + 1} → ${m}`);
        }
        for (const m of rgbMatches(line)) {
          if (allowed.has(m)) continue;
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

  it('the per-value exemption list is live — every listed value still exists verbatim in its file (stale/over-broad entries must be narrowed)', () => {
    for (const [file, { values, why }] of Object.entries(EXEMPT_VALUES)) {
      const entry = Object.entries(SOURCES).find(([k]) => appPath(k) === file);
      if (!entry)
        throw new Error(`${file} is exempted (“${why}”) but no longer exists — remove the entry`);
      const stripped = stripComments(entry[1]);
      for (const value of values) {
        expect(
          stripped.includes(value),
          `${file} is exempted for "${value}" (“${why}”) but that literal is no longer present — remove/narrow the entry`,
        ).toBe(true);
      }
    }
  });
});

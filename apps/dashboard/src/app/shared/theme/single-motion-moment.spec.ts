/**
 * redesign-stage-3 §3.3-2 / §8-2 — the SINGLE-MOTION-MOMENT pin (convexa-design skill §5,
 * structural): after the stage-3 consolidation the app has exactly ONE orchestrated motion
 * moment (the landing hero curve-draw), the kept DATA SIGNALS (flash-on-tick + the three live
 * pulses — `[live-vs-static-isolation]` made visible), and interaction feedback. Nothing else. A
 * new keyframe anywhere is a RED BUILD, not a review comment.
 *
 *   (a) stroke-dash draw keyframes exist ONLY in `pages/landing/HeroCurve.tsx` (THE moment);
 *   (b) `widgetRise` (the retired stagger) exists nowhere;
 *   (c) the GEX chart pins `isAnimationActive={false}` and carries no `animationDuration`
 *       (the retired mount bar-grow — §3.1-4; animation props only, geometry LOCKED);
 *   (d) the app-wide `@keyframes` inventory is SET-EQUAL to the kept allowlist
 *       {liveDotPulse, widgetLivePulse, ordersWatchPulse} + the dynamic flash-* family
 *       (declared only in `useFlashOnChange.ts`) + emotion `keyframes` used only by HeroCurve;
 *   (e) AC-54 (SB) / GATE Q bounce finding 3 — the three kept keyframes are exempt as a CLASS, not
 *       an enumerated allowlist with no enforced reasoning: canon rule 22, "Liveness is gated" — "A
 *       pulse ... may only run while a genuine stream is delivering; when it drops they stop." The
 *       class predicate itself is tested: a data-signal keyframe is exempt only while BOTH a live/
 *       data condition gates it AND reduced motion is off. (d)'s inventory-equality test is
 *       necessary but not sufficient for that — QA found `widgetLivePulse` actually running with the
 *       chip resolved to `closed` while this file stayed green, because nothing here checked the
 *       GATE, only the NAME.
 *
 * Scans use the Vite `?raw` glob idiom and are MUTATION-GUARDED per the house rule (a scan that
 * can't fail is worthless). Spec files are excluded (they may quote motion tokens in fixtures).
 */
import { describe, expect, it } from 'vitest';

const APP_SOURCES = import.meta.glob(['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** The kept named keyframes — the data signals, with their single home each. */
const KEPT_KEYFRAMES: Record<string, string> = {
  // Re-pointed, not deleted (AC-57 / [single-motion-moment], PLAN FE-5 step 6): the connection
  // chip's dot moved out of `TickerHeader.tsx`'s local `TintChip` into its own renderer at
  // curvature-v2-foundations — the DECLARATION moved with it, it was not copied.
  liveDotPulse: '/src/app/pages/ticker/connection/ConnectionChip.tsx',
  widgetLivePulse: '/src/app/shared/ui/Widget/Widget.tsx',
  ordersWatchPulse: '/src/app/features/trading/orders/OrderRow.tsx',
};
/** The one file allowed to declare a DYNAMIC keyframe name (the flash-* family). Promoted to
 *  `shared/hooks/` on its 2nd consumer (the /scanner price cell); the family is UNCHANGED — no new
 *  keyframe was added, so the inventory below stays SET-EQUAL. */
const FLASH_HOME = '/src/app/shared/hooks/useFlashOnChange.ts';
/** The one file allowed to use emotion's `keyframes` helper (THE moment: draw + baseline fade). */
const MOMENT_HOME = '/src/app/pages/landing/HeroCurve.tsx';

// ---- pure checkers (mutation-guarded) ----------------------------------------------------------

/** Every literal `@keyframes <name>` declared in a source. */
const namedKeyframesIn = (src: string): string[] =>
  Array.from(src.matchAll(/@keyframes\s+([A-Za-z][\w-]*)/g)).map((m) => m[1]);

/** Does a source declare a dynamic (template-interpolated) keyframe name? */
const declaresDynamicKeyframes = (src: string): boolean => /@keyframes\s+\$\{/.test(src);

/** Does a source use emotion's `keyframes` helper (import or tagged template)? */
const usesEmotionKeyframes = (src: string): boolean =>
  /\bkeyframes\s*`/.test(src) || /import\s*\{[^}]*\bkeyframes\b[^}]*\}/.test(src);

/** Does a source carry a stroke-dash draw (the moment's paint-only technique)? */
const usesStrokeDash = (src: string): boolean => src.includes('stroke-dashoffset');

const filesWhere = (pred: (src: string) => boolean): string[] =>
  Object.entries(APP_SOURCES)
    .filter(([, src]) => pred(src))
    .map(([file]) => file)
    .sort();

describe('single-motion-moment — the app-wide keyframe inventory (mutation-guarded)', () => {
  it('the glob is not vacuous (app sources actually loaded, incl. the named homes)', () => {
    expect(Object.keys(APP_SOURCES).length).toBeGreaterThan(40);
    expect(Object.keys(APP_SOURCES)).toContain(MOMENT_HOME);
    expect(Object.keys(APP_SOURCES)).toContain(FLASH_HOME);
    expect(Object.keys(APP_SOURCES)).toContain(KEPT_KEYFRAMES['widgetLivePulse']);
  });

  it('MUTATION GUARD: every checker flags its violation fixture and passes a clean one', () => {
    expect(namedKeyframesIn(`'@keyframes sneakyWow': { to: { opacity: 1 } }`)).toEqual([
      'sneakyWow',
    ]);
    expect(namedKeyframesIn('const clean = 1;')).toEqual([]);
    expect(declaresDynamicKeyframes('[`@keyframes ${name}`]: {}')).toBe(true);
    expect(declaresDynamicKeyframes(`'@keyframes fixedName': {}`)).toBe(false);
    expect(usesEmotionKeyframes('const grow = keyframes`from{opacity:0}`;')).toBe(true);
    expect(usesEmotionKeyframes(`import { keyframes } from '@mui/material/styles';`)).toBe(true);
    expect(usesEmotionKeyframes(`import { styled } from '@mui/material/styles';`)).toBe(false);
    expect(usesStrokeDash('from { stroke-dashoffset: 100; }')).toBe(true);
  });

  it('(a) stroke-dash draw keyframes live ONLY in HeroCurve — THE moment', () => {
    expect(filesWhere(usesStrokeDash)).toEqual([MOMENT_HOME]);
  });

  it('(b) widgetRise — the retired stagger keyframe — exists nowhere', () => {
    expect(filesWhere((src) => src.includes('widgetRise'))).toEqual([]);
  });

  it('(c) the GEX chart renders instantly: Structure Field has no Recharts mount animation', () => {
    const chart = APP_SOURCES['/src/app/pages/ticker/widgets/gex-profile-chart/chart.tsx'];
    expect(chart, 'chart.tsx must exist at its locked path').toBeTruthy();
    // Canvas Structure Field — pin documents the retired Recharts animation contract.
    expect(chart).toContain('isAnimationActive={false}');
    expect(chart).not.toContain('animationDuration');
    expect(chart).not.toContain('isAnimationActive={true}');
    expect(chart).toContain('StructureFieldCanvas');
    expect(chart).not.toContain("from 'recharts'");
    expect(chart).not.toContain('from "recharts"');
  });

  it('(d) the named @keyframes inventory is SET-EQUAL to the kept data-signal allowlist', () => {
    const inventory: Record<string, string[]> = {};
    for (const [file, src] of Object.entries(APP_SOURCES)) {
      for (const name of namedKeyframesIn(src)) (inventory[name] ??= []).push(file);
    }
    // Exact set equality — a new keyframe (or a renamed survivor) fails, in either direction.
    expect(Object.keys(inventory).sort()).toEqual(Object.keys(KEPT_KEYFRAMES).sort());
    // And each kept signal lives exactly in its one home.
    for (const [name, home] of Object.entries(KEPT_KEYFRAMES)) {
      expect(inventory[name], `${name} must be declared only in ${home}`).toEqual([home]);
    }
  });

  it('(d) dynamic keyframe names (flash-*) are declared ONLY by useFlashOnChange', () => {
    expect(filesWhere(declaresDynamicKeyframes)).toEqual([FLASH_HOME]);
  });

  it("(d) emotion's `keyframes` helper is consumed ONLY by HeroCurve (draw + baseline fade)", () => {
    expect(filesWhere(usesEmotionKeyframes)).toEqual([MOMENT_HOME]);
  });
});

// ---- (e) AC-54 — the data-signal CLASS predicate, not an enumerated exemption --------------------
//
// GATE Q bounce (curvature-v2-foundations, finding 3). A data-signal keyframe's `animation:`
// invocation is exempt from [single-motion-moment] ONLY while BOTH gates hold — canon rule 22:
//   1. a live/data condition reaches it — the invocation sits inside a block reachable only when
//      some genuinely-live-right-now boolean is true, never unconditionally emitted;
//   2. reduced motion is off — either a CSS `@media (prefers-reduced-motion: no-preference)` wrapper
//      or a `!reduced` term feeding the boolean that gates it (the three homes use both shapes).
// Neither gate alone is sufficient: QA found `widgetLivePulse` running with the chip resolved to
// `closed` — the reduced-motion gate held, the live gate was fed the WRONG boolean
// (`numbersActive`, which is blind to `market_session` and true during session-tape replay; fixed at
// its source in `LiveTape.tsx`, GATE Q bounce finding 1) — so a predicate that only checks "is this
// name still in the allowlist" cannot see that class of regression. This predicate checks the GATES,
// not the NAME.
describe('(e) AC-54 (SB) — the data-signal class predicate is enforced, not merely named', () => {
  /** True iff `keyframeName`'s `animation:` invocation in `src` sits behind BOTH `liveGatePattern`
   *  and a reduced-motion gate. The reduced-motion gate defaults to the CSS
   *  `@media (prefers-reduced-motion: no-preference)` wrapper; pass `reducedMotionGatePattern` for a
   *  home that gates it in JS instead (`liveDotPulse`'s `!reduced` lives in `copy.ts`, not a media
   *  query on the chip). Deliberately NOT a bare whole-file `/!reduced\b/` fallback — `Widget.tsx`
   *  uses `!reduced` twice for its UNRELATED View-Transition logic (`useExpand`, `:92`/`:447`), so an
   *  unscoped scan would pass vacuously on a file that gates SOMETHING with `!reduced`, not
   *  necessarily this keyframe. Absence of the invocation itself is `false`, never vacuously `true`. */
  const isLiveAndReducedMotionGated = (
    src: string,
    keyframeName: string,
    liveGatePattern: RegExp,
    reducedMotionGatePattern = /@media\s*\(\s*prefers-reduced-motion:\s*no-preference\s*\)/,
  ): boolean => {
    const animationInvocation = new RegExp(`animation:\\s*['"\`]?${keyframeName}\\b`);
    if (!animationInvocation.test(src)) return false;
    return reducedMotionGatePattern.test(src) && liveGatePattern.test(src);
  };

  it('MUTATION GUARD: the predicate flags a violation fixture (missing live gate, missing reduced-motion gate, or no invocation at all) and passes a clean one', () => {
    const clean = `...(live && { '@media (prefers-reduced-motion: no-preference)': { animation: 'fooPulse 1s infinite' } })`;
    expect(isLiveAndReducedMotionGated(clean, 'fooPulse', /live\s*&&/)).toBe(true);

    const noLiveGate = `sx={{ '@media (prefers-reduced-motion: no-preference)': { animation: 'fooPulse 1s infinite' } }}`;
    expect(isLiveAndReducedMotionGated(noLiveGate, 'fooPulse', /live\s*&&/)).toBe(false);

    const ignoresReducedMotion = `...(live && { animation: 'fooPulse 1s infinite' })`;
    expect(isLiveAndReducedMotionGated(ignoresReducedMotion, 'fooPulse', /live\s*&&/)).toBe(false);

    // The JS-level override shape (liveDotPulse's real shape): a custom reduced-motion pattern that
    // targets the ACTUAL gating boolean, not a bare file-wide `!reduced` scan.
    const jsLevelGate = `pulse: kind === 'live' && !reduced`;
    expect(
      isLiveAndReducedMotionGated(
        `...(live && { animation: 'fooPulse 1s infinite' })\n${jsLevelGate}`,
        'fooPulse',
        /live\s*&&/,
        /kind === 'live' && !reduced/,
      ),
    ).toBe(true);
    // The same override pattern correctly REJECTS a file that merely mentions `!reduced` for
    // something unrelated (the exact false-positive this default-avoids fallback exists to prevent).
    const unrelatedReducedUsage = `...(live && { animation: 'fooPulse 1s infinite' })\nif (!reduced && x) { y(); }`;
    expect(
      isLiveAndReducedMotionGated(unrelatedReducedUsage, 'fooPulse', /live\s*&&/, /kind === 'live' && !reduced/),
    ).toBe(false);

    const noInvocationAtAll = `const x = 1; // no keyframe use here`;
    expect(isLiveAndReducedMotionGated(noInvocationAtAll, 'fooPulse', /live\s*&&/)).toBe(false);
  });

  it('each kept data-signal keyframe is gated by BOTH a live condition and reduced-motion in its real, shipped source', () => {
    expect(
      isLiveAndReducedMotionGated(
        APP_SOURCES[KEPT_KEYFRAMES.widgetLivePulse],
        'widgetLivePulse',
        /\.\.\.\(\s*live\s*&&/,
      ),
      'widgetLivePulse (Widget.tsx) must sit behind BOTH `live &&` and the reduced-motion media query',
    ).toBe(true);

    // liveDotPulse's `animation:` invocation and live gate (`content.pulse`) live in
    // `ConnectionChip.tsx`; the reduced-motion half of that gate is JS-level, computed once in the
    // SEPARATE `copy.ts` (there is no media query on the chip itself). Check the concatenation of
    // both real files, not one in isolation — a checker scoped to only `ConnectionChip.tsx` would
    // find no reduced-motion gate at all and could only ever fail, which is not evidence of anything.
    const copySrc = APP_SOURCES['/src/app/pages/ticker/connection/copy.ts'];
    expect(copySrc, 'copy.ts must exist at its locked path').toBeTruthy();
    expect(
      isLiveAndReducedMotionGated(
        `${APP_SOURCES[KEPT_KEYFRAMES.liveDotPulse]}\n${copySrc}`,
        'liveDotPulse',
        /content\.pulse/,
        /pulse:\s*state\.kind === 'live'\s*&&\s*!reduced/,
      ),
      "liveDotPulse (ConnectionChip.tsx) must be gated on `content.pulse`, and copy.ts's `pulse` must itself check `!reduced`",
    ).toBe(true);

    expect(
      isLiveAndReducedMotionGated(
        APP_SOURCES[KEPT_KEYFRAMES.ordersWatchPulse],
        'ordersWatchPulse',
        /evalState\.kind === 'watching'/,
      ),
      "ordersWatchPulse (OrderRow.tsx) must be gated on `evalState.kind === 'watching'` and reduced-motion",
    ).toBe(true);
  });

  it('PREDICATE VIOLATION mutation proof: stripping the live gate from the REAL widgetLivePulse source is correctly rejected (the exact regression class QA found)', () => {
    const real = APP_SOURCES[KEPT_KEYFRAMES.widgetLivePulse];
    // A string transform ON THE REAL SOURCE (never a hand-authored fixture that could silently
    // drift from what the file actually looks like) simulating exactly QA's observed regression:
    // the live gate is gone, the reduced-motion media query is untouched.
    const poisoned = real.replace(/\.\.\.\(live\s+&&\s+!quiet\s+&&\s*\{/, '...(!quiet && {');
    expect(poisoned, 'the replace must actually have matched the real source').not.toBe(real);
    expect(
      isLiveAndReducedMotionGated(poisoned, 'widgetLivePulse', /\.\.\.\(\s*live\s*&&/),
    ).toBe(false);
    // The clean, unpoisoned source must still pass — the proof is that the predicate discriminates,
    // not that it always fails.
    expect(isLiveAndReducedMotionGated(real, 'widgetLivePulse', /\.\.\.\(\s*live\s*&&/)).toBe(true);
  });

  it('PREDICATE VIOLATION mutation proof: stripping the reduced-motion gate from the REAL widgetLivePulse source is correctly rejected', () => {
    const real = APP_SOURCES[KEPT_KEYFRAMES.widgetLivePulse];
    const poisoned = real.replace(
      /'@media \(prefers-reduced-motion: no-preference\)':\s*\{\s*animation: 'widgetLivePulse 2\.8s ease-in-out infinite',\s*\},/,
      "animation: 'widgetLivePulse 2.8s ease-in-out infinite',",
    );
    expect(poisoned, 'the replace must actually have matched the real source').not.toBe(real);
    expect(
      isLiveAndReducedMotionGated(poisoned, 'widgetLivePulse', /\.\.\.\(\s*live\s*&&/),
    ).toBe(false);
  });
});

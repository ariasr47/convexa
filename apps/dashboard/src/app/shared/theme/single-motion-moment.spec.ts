/**
 * redesign-stage-3 §3.3-2 / §8-2 — the SINGLE-MOTION-MOMENT pin (convexa-design skill §5,
 * structural): after the stage-3 consolidation the app has exactly ONE orchestrated motion
 * moment (the landing hero curve-draw), the kept DATA SIGNALS (flash-on-tick + the three live
 * pulses — `[live-vs-static-isolation]` made visible, exempt BY DECISION), and interaction
 * feedback. Nothing else. A new keyframe anywhere is a RED BUILD, not a review comment.
 *
 *   (a) stroke-dash draw keyframes exist ONLY in `pages/landing/HeroCurve.tsx` (THE moment);
 *   (b) `widgetRise` (the retired stagger) exists nowhere;
 *   (c) the GEX chart pins `isAnimationActive={false}` and carries no `animationDuration`
 *       (the retired mount bar-grow — §3.1-4; animation props only, geometry LOCKED);
 *   (d) the app-wide `@keyframes` inventory is SET-EQUAL to the kept allowlist
 *       {liveDotPulse, widgetLivePulse, ordersWatchPulse} + the dynamic flash-* family
 *       (declared only in `useFlashOnChange.ts`) + emotion `keyframes` used only by HeroCurve.
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
  liveDotPulse: '/src/app/pages/ticker/widgets/chrome/TickerHeader.tsx',
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

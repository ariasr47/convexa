/**
 * HeroCurve — THE one orchestrated moment's guards (redesign-stage-2 §8-2 / §8-3; these REPLACE
 * the deleted ConvexityMotif's coverage — a substitution, never a weakening).
 *
 *   §8-2 (named test) — reduced motion → the STATIC FINAL FRAME: no draw/animation class, no
 *         dash offset; with motion allowed the draw class IS present. Consumption of the SHARED
 *         `useReducedMotion` hook is asserted at source level (no bespoke media query).
 *   §8-3 — no layout shift, paint-only draw: (a) the wrapper is an absolute inset-0
 *         pointer-events-none overlay (className/injected-CSS assertions — never
 *         `getAttribute('style')`, per the convexa-design testing gotcha); (b) a mutation-guarded
 *         `?raw` source scan pins the animated property set to EXACTLY
 *         {stroke-dashoffset, opacity, transform}.
 *   §4.2 one-shot — the draw class is applied on mount and never re-toggled: a re-render keeps
 *         the same path node and the same class (a future landing data-hook can't make it replay).
 */
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HeroCurve } from './HeroCurve';

afterEach(() => {
  cleanup();
  (window as unknown as { matchMedia?: unknown }).matchMedia = undefined;
  vi.restoreAllMocks();
});

const HERO_CURVE_RAW = import.meta.glob(['/src/app/pages/landing/HeroCurve.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const heroCurveSrc = Object.values(HERO_CURVE_RAW)[0] ?? '';

function renderCurve() {
  return render(
    <ThemeProvider theme={theme}>
      <HeroCurve />
    </ThemeProvider>,
  );
}

/** All injected style text for the emotion classes of an element (never getAttribute('style')). */
function injectedCssFor(el: Element): string {
  const all = Array.from(document.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .join('\n');
  return Array.from(el.classList)
    .filter((c) => c.startsWith('css-'))
    .flatMap((c) => all.match(new RegExp(`\\.${c}\\{[^}]*\\}`, 'g')) ?? [])
    .join('\n');
}

function mockReducedMotion(matches: boolean) {
  (window as unknown as { matchMedia?: unknown }).matchMedia = vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

describe('§8-2 · reduced motion → static final frame (named test)', () => {
  it('prefers-reduced-motion: reduce → NO draw class, no dash offset (full stroke at rest)', () => {
    mockReducedMotion(true);
    const { getByTestId } = renderCurve();
    const path = getByTestId('hero-curve-path');
    expect(path.classList.contains('hero-curve-draw')).toBe(false);
    expect(path.classList.contains('hero-curve-path')).toBe(true);
    // The baseline sits at rest too — no fade class.
    expect(getByTestId('hero-curve-baseline').classList.contains('hero-curve-baseline-fade')).toBe(
      false,
    );
  });

  it('motion allowed → the draw class IS present (and the baseline fade with it)', () => {
    mockReducedMotion(false);
    const { getByTestId } = renderCurve();
    expect(getByTestId('hero-curve-path').classList.contains('hero-curve-draw')).toBe(true);
    expect(getByTestId('hero-curve-baseline').classList.contains('hero-curve-baseline-fade')).toBe(
      true,
    );
  });

  it('consumes the SHARED useReducedMotion hook — never a bespoke media query (source-level)', () => {
    expect(heroCurveSrc).toMatch(/from '@\/shared\/hooks\/useReducedMotion'/);
    expect(heroCurveSrc.includes('matchMedia')).toBe(false);
    // Belt-and-braces: the CSS reduce block also disables the classes (§4.2).
    expect(heroCurveSrc).toContain('@media (prefers-reduced-motion: reduce)');
  });
});

describe('§8-3 · paint-only draw, box reserved by construction', () => {
  it('(a) the wrapper is an absolute inset-0 pointer-events-none overlay (injected-CSS assertion)', () => {
    const { getByTestId: get } = renderCurve();
    const css = injectedCssFor(get('hero-curve'));
    expect(css).toContain('position:absolute');
    expect(css).toContain('inset:0');
    expect(css).toContain('pointer-events:none');
    // Decorative only.
    expect(get('hero-curve')).toHaveAttribute('aria-hidden', 'true');
  });

  it('(b) MUTATION GUARD: the keyframe-property checker fails on a layout property', () => {
    expect(keyframeProps('keyframes`from { width: 0 } to { width: 10px }`')).toContain('width');
    expect(
      keyframeProps('keyframes`from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; }`'),
    ).toEqual(['stroke-dashoffset', 'stroke-dashoffset']);
  });

  it('(b) keyframes animate ONLY {stroke-dashoffset, opacity, transform}; no transitions', () => {
    const props = keyframeProps(heroCurveSrc);
    expect(props.length, 'HeroCurve must declare keyframes').toBeGreaterThan(0);
    const allowed = new Set(['stroke-dashoffset', 'opacity', 'transform']);
    expect(props.filter((p) => !allowed.has(p))).toEqual([]);
    // No CSS transitions ride along either — the dash draw + fades are the whole motion.
    expect(/transition\s*:/.test(heroCurveSrc)).toBe(false);
  });

  it('no fill, no glow, no radial-gradient — the curve is a stroke, the blob stays dead', () => {
    expect(heroCurveSrc.includes('radial-gradient')).toBe(false);
    expect(heroCurveSrc).toContain('fill="none"');
  });
});

describe('§4.2 · one-shot on mount — never replays on re-render', () => {
  it('a re-render keeps the same curve node with the same draw class (no toggle, no remount)', () => {
    mockReducedMotion(false);
    const { getByTestId, rerender } = render(
      <ThemeProvider theme={theme}>
        <HeroCurve />
      </ThemeProvider>,
    );
    const before = getByTestId('hero-curve-path');
    expect(before.classList.contains('hero-curve-draw')).toBe(true);
    rerender(
      <ThemeProvider theme={theme}>
        <HeroCurve />
      </ThemeProvider>,
    );
    const after = getByTestId('hero-curve-path');
    expect(after).toBe(before); // same node — the animation cannot restart
    expect(after.classList.contains('hero-curve-draw')).toBe(true);
  });
});

/** Pure checker (mutation-tested above): CSS property names inside keyframes template blocks. */
function keyframeProps(src: string): string[] {
  const blocks = src.match(/keyframes`[\s\S]*?`/g) ?? [];
  const props: string[] = [];
  for (const b of blocks) {
    for (const m of b.matchAll(/([a-zA-Z-]+)\s*:/g)) props.push(m[1]);
  }
  return props;
}

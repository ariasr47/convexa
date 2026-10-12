/**
 * HeroCurve — THE one orchestrated moment's guards (redesign-stage-2 §8-2 / §8-3; these REPLACE
 * the deleted ConvexityMotif's coverage — a substitution, never a weakening).
 *
 *   §8-2 (named test) — reduced motion → the STATIC FINAL FRAME: no draw/animation class, no
 *         dash offset; with motion allowed the draw class IS present. Consumption of the SHARED
 *         `useReducedMotion` hook is asserted at source level (no bespoke media query).
 *   §8-3 — no layout shift, paint-only draw: a mutation-guarded `?raw` source scan pins the
 *         animated property set to EXACTLY {stroke-dashoffset, opacity, transform}.
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

describe('§8-3 · paint-only draw', () => {
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

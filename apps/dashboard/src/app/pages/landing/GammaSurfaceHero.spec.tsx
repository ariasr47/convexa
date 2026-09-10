/**
 * GammaSurfaceHero — the hero instrument's guards (PLAN.md `### F5`, SPEC §2.3/§2.2 item 1/§7
 * items 2/3/17).
 *
 * The six tests in the first `describe` are PLAN.md's own Step-1 failing test, unmodified.
 *
 * The second `describe` closes a coverage gap those six do not reach: they prove the wireframe,
 * ridges and spot EXIST in the DOM, but none of them prove they PAINT anything — a `data-testid`
 * query passes whether or not the element is visible. `fill`/`stroke` are not registered in
 * `@mui/system`'s `defaultSxConfig` (only `color`/`bgcolor`/`backgroundColor`/… auto-resolve a
 * dot-path string like `'primary.main'`), so a bare string there is emitted as invalid CSS and
 * silently drops to the SVG initial value — `fill:black` / `stroke:none` — passing every assertion
 * above while rendering an invisible wireframe and a black spot dot. This block asserts the actual
 * CSS text emotion injects (the "convexa-design testing gotcha": emotion emits class-scoped CSS
 * into a `<style>` tag, never an inline `style="..."` attribute — see `shared/ui/ArcDivider.spec.tsx`
 * for the same `injectedCssFor` idiom), so a regression back to a bare theme-path string red-builds.
 */
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GammaSurfaceHero } from './GammaSurfaceHero';

afterEach(() => cleanup());

const HERO_RAW = import.meta.glob(['/src/app/pages/landing/GammaSurfaceHero.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function renderHero() {
  return render(
    <ThemeProvider theme={theme}>
      <GammaSurfaceHero />
    </ThemeProvider>,
  );
}

describe('AC-L4a — the hero instrument is the dealer-gamma surface over strike × tenor', () => {
  it('renders one <svg> with role=img and the accessible name', () => {
    renderHero();
    const svg = screen.getByRole('img', { name: 'Dealer gamma surface across strike and tenor' });
    expect(svg.tagName.toLowerCase()).toBe('svg');
  });

  it('carries the wireframe (9 tenor rows + 21 strike columns) and the three named ridges', () => {
    const { container } = renderHero();
    expect(container.querySelectorAll('[data-testid="gs-wire"]')).toHaveLength(30);
    for (const id of ['gs-ridge-flip', 'gs-ridge-call-wall', 'gs-ridge-put-wall']) {
      expect(container.querySelector(`[data-testid="${id}"]`)).not.toBeNull();
    }
  });

  it('SPEC §2.3 — the SVG paints NO text at all, and no beam/pulse marker', () => {
    const { container } = renderHero();
    expect(container.querySelectorAll('text')).toHaveLength(0);
    expect(container.innerHTML).not.toContain('573.12');
    expect(container.innerHTML).not.toContain('568.50');
    expect(container.querySelectorAll('.beam')).toHaveLength(0);
  });

  it('the radial glow is the camelCase SVG element, NOT the hyphenated CSS function', () => {
    const src = HERO_RAW['/src/app/pages/landing/GammaSurfaceHero.tsx'];
    expect(src).toContain('radialGradient');
    expect(src).not.toContain('radial-gradient'); // landing-structure.spec.tsx's earned scan
  });

  it('SPEC §7 item 3 — no runtime surface: no getContext, no rAF, no useEffect, no arc primitive', () => {
    const src = HERO_RAW['/src/app/pages/landing/GammaSurfaceHero.tsx'];
    expect(src).not.toContain('getContext(');
    expect(src).not.toContain('requestAnimationFrame');
    expect(src).not.toContain('useEffect');
    expect(src).not.toContain('<canvas');
    expect(src).not.toContain('WebGLRenderingContext');
    expect(src).not.toContain("from '@/shared/ui/arc'"); // the 4th importer red-builds arc.spec.ts
    expect(src).not.toContain('keyframes');
  });

  it('geometry is computed ONCE at module load — two renders produce identical path data', () => {
    const a = renderHero().container.innerHTML;
    cleanup();
    const b = renderHero().container.innerHTML;
    expect(a).toBe(b);
  });
});

/** All injected style text for the emotion classes of an element (see file header). */
function injectedCssFor(el: Element): string {
  const all = Array.from(document.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .join('\n');
  return Array.from(el.classList)
    .filter((c) => c.startsWith('css-'))
    .flatMap((c) => all.match(new RegExp(`\\.${c}\\{[^}]*\\}`, 'g')) ?? [])
    .join('\n');
}

describe('resolved paint, not a broken theme path', () => {
  it('the wireframe strokes resolve to the real text.secondary colour, never the literal string', () => {
    const { container } = renderHero();
    const wire = container.querySelector('[data-testid="gs-wire"]');
    expect(wire).not.toBeNull();
    const css = injectedCssFor(wire as Element);
    expect(css).toContain(`stroke:${theme.palette.text.secondary}`);
    expect(css).not.toContain('stroke:text.secondary');
  });

  it('the put-wall / call-wall ridges resolve to the signed-direction slots (SPEC reviewer probe)', () => {
    const { container } = renderHero();
    const put = container.querySelector('[data-testid="gs-ridge-put-wall"]') as Element;
    const call = container.querySelector('[data-testid="gs-ridge-call-wall"]') as Element;
    expect(injectedCssFor(put)).toContain(`stroke:${theme.palette.error.main}`);
    expect(injectedCssFor(call)).toContain(`stroke:${theme.palette.success.main}`);
    // Non-vacuous: the two RESERVED signed-direction slots (tokens.ts:62-63) are not the same hue.
    expect(theme.palette.error.main).not.toBe(theme.palette.success.main);
  });

  it('the flip ridge and the glow resolve to primary.main (design `--amber`), byte-exact both modes', () => {
    const { container } = renderHero();
    const flip = container.querySelector('[data-testid="gs-ridge-flip"]') as Element;
    expect(injectedCssFor(flip)).toContain(`stroke:${theme.palette.primary.main}`);
    const glow = container.querySelector('rect') as Element;
    expect(injectedCssFor(glow)).toContain(`color:${theme.palette.primary.main}`);
  });

  it('the spot marker resolves to info.main (design `--signal`), never the amber primary fill', () => {
    const { container } = renderHero();
    const spot = container.querySelector('[data-testid="gs-spot"]') as Element;
    const css = injectedCssFor(spot);
    expect(css).toContain(`fill:${theme.palette.info.main}`);
    expect(css).not.toContain('fill:primary.main');
    // Non-vacuous: info and primary are genuinely different hues in this theme.
    expect(theme.palette.info.main).not.toBe(theme.palette.primary.main);
  });
});

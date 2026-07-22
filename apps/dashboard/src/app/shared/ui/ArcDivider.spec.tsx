/**
 * ArcDivider — the shared arc seam's structural guards (redesign-stage-2 §5.1):
 *   - it replaces a `<Divider/>` (= `<hr>`), so the wrapper carries `role="separator"` +
 *     `aria-orientation="horizontal"`; the SVG itself is decorative (aria-hidden);
 *   - height is FIXED/reserved (no layout shift vs the replaced rule) — injected-CSS assertion,
 *     never `getAttribute('style')` (the convexa-design testing gotcha);
 *   - quiet structure: the stroke binds the `divider` palette slot via `currentColor` at
 *     width 1 — the signature is the shape, not a new amber spend;
 *   - it accepts `sx` so call sites carry over the replaced Divider's margin.
 */
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ArcDivider } from './ArcDivider';

afterEach(() => cleanup());

/** All injected style text for the emotion classes of an element. */
function injectedCssFor(el: Element): string {
  const all = Array.from(document.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .join('\n');
  return Array.from(el.classList)
    .filter((c) => c.startsWith('css-'))
    .flatMap((c) => all.match(new RegExp(`\\.${c}\\{[^}]*\\}`, 'g')) ?? [])
    .join('\n');
}

describe('ArcDivider · the shared arc seam', () => {
  it('is a horizontal separator wrapping a decorative SVG arc', () => {
    render(
      <ThemeProvider theme={theme}>
        <ArcDivider />
      </ThemeProvider>,
    );
    const divider = screen.getByTestId('arc-divider');
    expect(divider).toHaveAttribute('role', 'separator');
    expect(divider).toHaveAttribute('aria-orientation', 'horizontal');
    const svg = divider.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    // One shallow convex arc from the shared builder, stroke = currentColor at width 1.
    const path = svg?.querySelector('path');
    expect(path?.getAttribute('d')).toMatch(/^M .* Q .*/);
    expect(path?.getAttribute('stroke')).toBe('currentColor');
    expect(path?.getAttribute('stroke-width')).toBe('1');
    expect(path?.getAttribute('fill')).toBe('none');
  });

  it('reserves a fixed height and binds the divider slot (injected-CSS assertion)', () => {
    render(
      <ThemeProvider theme={theme}>
        <ArcDivider />
      </ThemeProvider>,
    );
    const css = injectedCssFor(screen.getByTestId('arc-divider'));
    expect(css).toContain('height:20px');
    // `color: 'divider'` resolves to the theme's divider slot (emitted as the MUI CSS var —
    // theme.ts `cssVariables: true`); the stroke rides currentColor.
    expect(css).toContain('color:var(--mui-palette-divider)');
  });

  it('accepts sx — the replaced Divider call-site margin carries over', () => {
    render(
      <ThemeProvider theme={theme}>
        <ArcDivider sx={{ mb: 3 }} />
      </ThemeProvider>,
    );
    const css = injectedCssFor(screen.getByTestId('arc-divider'));
    // Theme spacing 3 → 24px (--mui-spacing = 8px), emitted as the CSS-var calc.
    expect(css).toContain('margin-bottom:calc(3 * var(--mui-spacing))');
  });
});

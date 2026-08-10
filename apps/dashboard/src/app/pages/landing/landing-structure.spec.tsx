/**
 * Landing structure — redesign-stage-2 §8-7 / §8-8:
 *
 *   §8-8 — the landing landmark + heading order (Stage 0 §10.2 deferral, landed): exactly one
 *          `<main>`, exactly one `<h1>`, the outline walks h1 → h2 → h3 with no skipped level and
 *          NO h4–h6; card titles render as h3. (Extends the Stage-0 heading-semantics pattern.)
 *   §8-7 — the radial blob is REMOVED, as negative space: zero `radial-gradient` across
 *          `pages/landing/**` AND `shared/ui/ValueCard.tsx` (the hero blob removal §4.4 and the
 *          remove-one-accessory cut §6.3 guard each other), and `ConvexityMotif` no longer exists
 *          anywhere (zero references app-wide). Scans are `?raw` + MUTATION-GUARDED (house rule).
 */
import { theme } from '@/shared/theme/theme';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { Landing } from './Landing';

afterEach(() => cleanup());

const LANDING_SOURCES = import.meta.glob(
  ['/src/app/pages/landing/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const VALUE_CARD_RAW = import.meta.glob(['/src/app/shared/ui/ValueCard.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const APP_SOURCES = import.meta.glob(['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Pure checker (mutation-tested): a radial-gradient occurrence. */
const hasRadialGradient = (src: string): boolean => src.includes('radial-gradient');
/** Pure checker (mutation-tested): any reference to the deleted ConvexityMotif. */
const referencesMotif = (src: string): boolean => src.includes('ConvexityMotif');

function renderLanding() {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter initialEntries={['/']}>
        <Landing />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('§8-8 · landing landmark + heading order', () => {
  it('exactly one <main> landmark; the footer stays outside it', () => {
    const { container } = renderLanding();
    const mains = container.querySelectorAll('main');
    expect(mains).toHaveLength(1);
    // The Footer is a <footer> OUTSIDE the main landmark (§6.1).
    const footer = screen.getByTestId('site-footer');
    expect(footer.tagName.toLowerCase()).toBe('footer');
    expect(mains[0].contains(footer)).toBe(false);
    // The hero + value cards + coming-soon band all live INSIDE it.
    expect(mains[0].contains(screen.getByTestId('hero-curve'))).toBe(true);
    expect(mains[0].contains(screen.getByTestId('vp-scanner'))).toBe(true);
    expect(mains[0].contains(screen.getByTestId('vp-ticker'))).toBe(true);
    expect(mains[0].contains(screen.getByTestId('brokerage-block'))).toBe(true);
  });

  it('exactly one h1; the walk is h1 → h2 → h3… with no skipped level and NO h4–h6', () => {
    const { container } = renderLanding();
    const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    expect(headings.length).toBeGreaterThanOrEqual(3);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelectorAll('h4, h5, h6')).toHaveLength(0);
    // No skipped level in document order (a step down of more than one level fails).
    const levels = headings.map((h) => Number(h.tagName[1]));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    }
    // The section label is the h2 (styling stays overline — §6.2).
    expect(screen.getByText('What works today').tagName.toLowerCase()).toBe('h2');
  });

  it('card titles render as h3 (ValueCard AND ComingSoonCard, under the same outline)', () => {
    renderLanding();
    for (const testId of [
      'vp-scanner',
      'vp-ticker',
      'vp-positions',
      'vp-airec',
      'brokerage-block',
    ]) {
      const card = screen.getByTestId(testId);
      expect(within(card).getByRole('heading', { level: 3 })).toBeInTheDocument();
      expect(card.querySelectorAll('h1, h2, h4, h5, h6')).toHaveLength(0);
    }
  });
});

describe('§8-7 · the radial blob is gone — negative space (mutation-guarded scans)', () => {
  it('the globs are not vacuous', () => {
    expect(Object.keys(LANDING_SOURCES).length).toBeGreaterThanOrEqual(2); // Landing + HeroCurve
    expect(Object.keys(VALUE_CARD_RAW)).toHaveLength(1);
    expect(Object.keys(APP_SOURCES).length).toBeGreaterThan(40);
  });

  it('MUTATION GUARD: the checkers flag fixtures', () => {
    expect(hasRadialGradient(`background: radial-gradient(60% 50%, red, blue)`)).toBe(true);
    expect(hasRadialGradient(`background: linear-gradient(90deg, red, blue)`)).toBe(false);
    expect(referencesMotif(`import { ConvexityMotif } from '@/shared/ui';`)).toBe(true);
    expect(referencesMotif(`import { HeroCurve } from './HeroCurve';`)).toBe(false);
  });

  it('zero radial-gradient across pages/landing/** AND ValueCard (blob + accessory cut)', () => {
    const violations = [
      ...Object.entries(LANDING_SOURCES),
      ...Object.entries(VALUE_CARD_RAW),
    ].filter(([, src]) => hasRadialGradient(src));
    expect(violations.map(([f]) => f)).toEqual([]);
  });

  it('ConvexityMotif no longer exists — zero references app-wide (file AND name)', () => {
    expect(Object.keys(APP_SOURCES).some((f) => f.includes('ConvexityMotif'))).toBe(false);
    const referencing = Object.entries(APP_SOURCES)
      .filter(([, src]) => referencesMotif(src))
      .map(([f]) => f);
    expect(referencing).toEqual([]);
  });
});

/**
 * Landing structure — SPEC §7 items 2/6/17; PLAN F7 step 4.
 *
 *   §8-8 — the landing landmark + heading order: exactly one `<main>`, exactly one `<h1>`, the
 *          outline walks h1 → h2 → h3 with no skipped level and NO h4–h6; the three trust-card
 *          titles render as h3. RE-HOMED onto `<App/>` at `/` (shell + footer present): a
 *          STANDALONE `<Landing/>` render no longer carries either landmark — both moved to
 *          `AppShell`/`Footer` (F3) — so querying them on a bare `<Landing/>` is now a hard red
 *          build, which is the point (F3's own `AppShell.footer.spec.tsx` covers the general
 *          "one footer / one main on every in-shell route" case; this file keeps the LANDING-
 *          specific heading-outline assertion).
 *   §7 item 17 (rendered half) — the hero panel's three cut phrases (`three.js`, `7d → 90d`,
 *          `own bundle`) never reach the rendered page, hero caption and legend included. The
 *          SOURCE half (a `?raw` scan excluding spec files) is F13's; this is the DOM half, so a
 *          phrase arriving through an imported copy module is caught too.
 *   §8-7 — the radial blob is REMOVED, as negative space: zero `radial-gradient` across
 *          `pages/landing/**` (the hero-blob removal §4.4), and `ConvexityMotif` no longer exists
 *          anywhere (zero references app-wide). Scans are `?raw` + MUTATION-GUARDED (house rule),
 *          KEPT BYTE-FOR-BYTE per SPEC §7 — except ONE deliberate pin edit (PLAN "Contradictions
 *          surfaced" C1): the `VALUE_CARD_RAW` glob and its two references are removed, because
 *          F12 (a separate, later task) deletes `shared/ui/ValueCard.tsx`, and a glob over a
 *          deleted file fails `toHaveLength(1)`. This narrows NOTHING — the scanned file's own
 *          negative-space property (no radial-gradient) is unrelated to whether the file exists;
 *          `ValueCard.tsx` is untouched by this task and is still scanned today via `APP_SOURCES`
 *          for the `ConvexityMotif` check below.
 */
import { theme } from '@/shared/theme/theme';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/app';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => {
  vi.stubGlobal(
    'EventSource',
    class {
      close() {
        /* no-op */
      }
    } as unknown as typeof EventSource,
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/api/auth/session'))
        return json({ authenticated: false, user: null, google_available: false, settings: null });
      return json(null);
    }),
  );
});

const LANDING_SOURCES = import.meta.glob(
  ['/src/app/pages/landing/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const APP_SOURCES = import.meta.glob(['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Pure checker (mutation-tested): a radial-gradient occurrence. */
const hasRadialGradient = (src: string): boolean => src.includes('radial-gradient');
/** Pure checker (mutation-tested): any reference to the deleted ConvexityMotif. */
const referencesMotif = (src: string): boolean => src.includes('ConvexityMotif');

/** `<App/>` at `/` — the shell + the footer are present, unlike a standalone `<Landing/>` render. */
function renderLandingInShell() {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('§8-8 · landing landmark + heading order (App shell, / route)', () => {
  it('exactly one <main> landmark; the footer stays outside it; every landing section is inside it', async () => {
    const { container } = renderLandingInShell();
    await screen.findByTestId('site-footer');

    const mains = container.querySelectorAll('main');
    expect(mains).toHaveLength(1);
    // The Footer is a <footer> OUTSIDE the main landmark (F3; AC-F4).
    const footer = screen.getByTestId('site-footer');
    expect(footer.tagName.toLowerCase()).toBe('footer');
    expect(mains[0].contains(footer)).toBe(false);
    // The hero curve + all six landing sections live INSIDE it.
    expect(mains[0].contains(screen.getByTestId('hero-curve'))).toBe(true);
    for (const section of ['hero', 'field', 'score', 'ai-read', 'register', 'cta']) {
      const el = container.querySelector(`[data-section="${section}"]`);
      expect(el, `data-section="${section}" not found`).not.toBeNull();
      expect(mains[0].contains(el)).toBe(true);
    }
  });

  it('exactly one h1; the walk is h1 → h2 → h3… with no skipped level and NO h4–h6', async () => {
    const { container } = renderLandingInShell();
    await screen.findByTestId('site-footer');

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
    // AC-L2 — the retired v1 "What works today" section label no longer exists anywhere.
    expect(screen.queryByText('What works today')).toBeNull();
  });

  it('the three trust-card titles render as h3, under the register section (re-pointed card-title check)', async () => {
    renderLandingInShell();
    await screen.findByTestId('site-footer');

    const register = screen.getAllByTestId('landing-section')[4];
    for (const title of ['Snapshot, never live', 'Simulated, always', 'Advisory, never an order']) {
      expect(within(register).getByRole('heading', { level: 3, name: title })).toBeInTheDocument();
    }
    // Exactly one h3 per card (no card title doubles as h1/h4-h6); the section's OWN h2 heading
    // ("Numbers say where they came from.") is the one legitimate non-h3 heading here.
    expect(register.querySelectorAll('h3')).toHaveLength(3);
    expect(register.querySelectorAll('h1, h4, h5, h6')).toHaveLength(0);
  });
});

describe('§7 item 17 (rendered half) — the three cut phrases never reach the page', () => {
  it('the landing textContent, hero caption and legend included, carries none of them', async () => {
    const { container } = renderLandingInShell();
    await screen.findByTestId('site-footer');
    for (const phrase of ['three.js', '7d → 90d', 'own bundle']) {
      expect(container.textContent).not.toContain(phrase);
    }
  });
});

describe('§8-7 · the radial blob is gone — negative space (mutation-guarded scans)', () => {
  it('the globs are not vacuous', () => {
    expect(Object.keys(LANDING_SOURCES).length).toBeGreaterThanOrEqual(2); // Landing + HeroCurve
    expect(Object.keys(APP_SOURCES).length).toBeGreaterThan(40);
  });

  it('MUTATION GUARD: the checkers flag fixtures', () => {
    expect(hasRadialGradient(`background: radial-gradient(60% 50%, red, blue)`)).toBe(true);
    expect(hasRadialGradient(`background: linear-gradient(90deg, red, blue)`)).toBe(false);
    expect(referencesMotif(`import { ConvexityMotif } from '@/shared/ui';`)).toBe(true);
    expect(referencesMotif(`import { HeroCurve } from './HeroCurve';`)).toBe(false);
  });

  it('zero radial-gradient across pages/landing/** (blob cut)', () => {
    const violations = Object.entries(LANDING_SOURCES).filter(([, src]) => hasRadialGradient(src));
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

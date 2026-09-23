/**
 * GATE Z I-7 (SPEC amendment 6, AC-L18) — the landing's h1 and every h2 render in the canon
 * display face, Archivo, at the landing display scale (`DESIGN_SYSTEM.md:100`), never IBM Plex
 * Sans.
 *
 * ROOT CAUSE (why the visual baseline caught this and no prior unit test did): MUI's
 * `component="h1"` prop only picks the rendered DOM TAG — it does not, on its own, apply
 * `theme.typography.h1`'s STYLES (the `fontFamily`/`fontStretch` this file pins). Only an
 * explicit `variant="h1"` (or `variant="h2"`) does that; `Landing.tsx` set `component` alone on
 * every heading, so every one of them rendered with the default `body1` styling — Plex Sans —
 * despite being a real `<h1>`/`<h2>` in the DOM. The fix adds the missing `variant` prop
 * alongside the existing `component` prop (the same paired idiom `MethodologyPage.tsx`'s own h1
 * already uses: `component="h1" variant="h4"`); this file is the regression guard.
 *
 * "In both schemes" is tested because the display face is scheme-invariant by construction (no
 * `sx` branch on `theme.palette.mode` touches `fontFamily` anywhere in this file), so a real
 * per-scheme render is what actually proves that, rather than assuming it. "At 393 and 1280" is
 * tested the same way: `fontFamily` carries no responsive breakpoint object in `Landing.tsx`, so
 * a real render at each width is what proves a future responsive override cannot silently narrow
 * the face to one viewport.
 */
import { theme as darkTheme, lightTheme } from '@/shared/theme/theme';
import { typographyTokens } from '@/shared/theme/tokens';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, type Theme } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Landing } from './Landing';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            authenticated: false,
            user: null,
            google_available: false,
            settings: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

function renderLanding(activeTheme: Theme) {
  return render(
    <ThemeProvider theme={activeTheme}>
      <CssBaseline />
      <MemoryRouter initialEntries={['/']}>
        <Landing />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('AC-L18 — the landing h1/h2 computed font-family resolves to Archivo, both schemes, 393 and 1280', () => {
  for (const [schemeLabel, activeTheme] of [
    ['dark', darkTheme],
    ['light', lightTheme],
  ] as const) {
    for (const width of [393, 1280]) {
      it(`${schemeLabel} @ ${width}px — h1 and every h2 resolve Archivo, never Plex Sans`, () => {
        setViewportWidth(width);
        const { container } = renderLanding(activeTheme);

        const h1 = container.querySelector('h1');
        expect(h1, 'the landing has exactly one <h1>').not.toBeNull();
        const h1Family = getComputedStyle(h1!).fontFamily;
        expect(h1Family).toContain('Archivo');
        expect(h1Family).not.toBe(typographyTokens.fontFamily);

        const h2s = Array.from(container.querySelectorAll('h2'));
        expect(h2s.length).toBeGreaterThan(0);
        for (const h2 of h2s) {
          const h2Family = getComputedStyle(h2).fontFamily;
          expect(h2Family, h2.textContent ?? '<h2>').toContain('Archivo');
          expect(h2Family, h2.textContent ?? '<h2>').not.toBe(typographyTokens.fontFamily);
        }
      });
    }
  }

  it('sanity — a body element on the SAME render stays Plex Sans (the display face is not app-wide)', () => {
    const { container } = renderLanding(darkTheme);
    const body = screen.getByText(/Convexa turns an option chain/i);
    expect(container.contains(body)).toBe(true);
    expect(getComputedStyle(body).fontFamily).not.toContain('Archivo');
  });
});

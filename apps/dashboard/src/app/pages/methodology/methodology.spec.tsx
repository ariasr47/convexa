/**
 * `/methodology` render-level tests (SPEC §7; PLAN.md F10 — "Spec cases (7)").
 *
 * The seven cases named in the plan, and nothing else (V-5's baseline count pins F10 at exactly
 * 7 net-new cases): (1) ten sections in order; (2) every section `id` resolves to a rendered
 * element (AC-M1 deep link); (3) the on-this-page index has exactly ten entries whose hrefs
 * equal the section ids; (4) the score section states the two-stage clamp and the score's
 * honest scope (AC-M2a, AC-M3); (5) the vocabulary table has exactly `NOT_A_NUMBER.length` rows,
 * each literal cell resolved Plex Sans (AC-M4, rule 24); (6) every anchor on the page resolves
 * to a route in `app.tsx`'s table or a static document under `public/` (§7 item 11, AC-M5); (7)
 * the page mentions no persona, flows or operator screen (AC-M5b).
 *
 * What is deliberately NOT here (`copy.spec.ts`'s job, at the data layer, same content):
 * the ten ids/headings themselves, the block-level discriminated union's shape, the vocabulary
 * set-equality against `NOT_A_NUMBER`, the three quoted deltas landing byte-exact, and the nine
 * retired v1 fragments' absence. Byte-for-byte provenance against
 * `design/src/screens/methodology.mjs` (AC-C1a) and the score table's `Max` column against
 * `libs/quant-engine/src/signals.rs` (AC-M2) are PLAN.md F13's structural spec, homed outside
 * `pages/**`, not duplicated here.
 */
import { NOT_A_NUMBER } from '@/shared/copy/notANumber';
import { SANS_FACE } from '@/shared/figure';
import { theme } from '@/shared/theme/theme';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, within } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { METHOD_COPY } from './copy';
import { MethodologyPage } from './MethodologyPage';

afterEach(() => cleanup());

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter>
        <MethodologyPage />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

/** Walks up from cwd to the Nx workspace root — same idiom as `blog.spec.tsx`'s
 *  `workspaceRoot()` and the app's `.structural.spec.ts` files, duplicated here on purpose so
 *  this colocated spec stays self-contained (no cross-page import — the deny-list bans it). */
function workspaceRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'nx.json'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('nx workspace root not found from ' + process.cwd());
}

describe('MethodologyPage (/methodology) — SPEC §7, PLAN F10', () => {
  it('1. renders all ten sections, in METHOD_COPY.sections order (AC-M1)', () => {
    renderPage();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(METHOD_COPY.sections).toHaveLength(10);
    expect(headings).toEqual(METHOD_COPY.sections.map((s) => s.h));
  });

  it('2. every section id resolves to a rendered element on the page (AC-M1 deep link)', () => {
    renderPage();
    for (const section of METHOD_COPY.sections) {
      expect(document.getElementById(section.id), section.id).not.toBeNull();
    }
  });

  it('3. the on-this-page index has exactly ten entries whose hrefs equal the section ids, in order', () => {
    renderPage();
    const toc = screen.getByTestId('methodology-toc');
    const links = within(toc).getAllByRole('link');
    expect(links).toHaveLength(10);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(
      METHOD_COPY.sections.map((s) => `#${s.id}`),
    );
  });

  it("4. the score section states the two-stage clamp and the score's honest scope (AC-M2a, AC-M3)", () => {
    renderPage();
    const text = document.getElementById('score-and-tier')?.textContent ?? '';
    expect(text).toMatch(/capped twice/);
    expect(text).toMatch(/no score ever exceeds 100/);
    expect(text).toMatch(/does not consume vol-normalized GEX/);
    expect(text).toMatch(/IV-rank band/);
  });

  it('5. the vocabulary table has exactly NOT_A_NUMBER.length rows, each literal cell resolved Plex Sans (AC-M4, rule 24)', () => {
    // `copy.spec.ts` already proves set-EQUALITY (both directions) against the union at the data
    // layer; this case is the render counterpart — row COUNT plus the resolved font, driven by
    // the same imported union so neither number is ever a hand-typed literal.
    renderPage();
    const cells = screen.getAllByTestId('vocab-literal');
    expect(cells).toHaveLength(NOT_A_NUMBER.length);
    // jsdom's CSSOM serializes a quoted font-family with double quotes (spec-compliant computed-
    // style behaviour); normalize before comparing so this is a real equality check against the
    // token, not a substring/contains check.
    const normalizeQuotes = (fontFamily: string) => fontFamily.replace(/"/g, "'");
    for (const cell of cells) {
      expect(normalizeQuotes(getComputedStyle(cell).fontFamily)).toBe(SANS_FACE.fontFamily);
    }
  });

  it("6. every anchor on the page resolves to a route in app.tsx's table or a static document under public/ (§7 item 11, AC-M5)", () => {
    const root = workspaceRoot();
    const appTsxSource = readFileSync(
      resolve(root, 'apps', 'dashboard', 'src', 'app', 'app.tsx'),
      'utf8',
    );
    const routePaths = new Set([...appTsxSource.matchAll(/path="([^"]+)"/g)].map((m) => m[1]));
    // The home route is declared `<Route index .../>`, not `path="/"` — it is still a member of
    // the route table.
    if (/<Route\s+index\b/.test(appTsxSource)) routePaths.add('/');

    const { container } = renderPage();
    const anchors = Array.from(container.querySelectorAll('a[href]'));
    // Non-vacuity: the page really has anchors to walk (ten TOC entries + three CTAs).
    expect(anchors.length).toBeGreaterThanOrEqual(13);
    for (const a of anchors) {
      const href = a.getAttribute('href') ?? '';
      if (href.startsWith('#')) continue; // same-page fragment — always resolves
      const staticDoc = resolve(root, 'apps', 'dashboard', 'public', href.replace(/^\//, ''));
      const resolves = routePaths.has(href) || existsSync(staticDoc);
      expect(resolves, `dead link: ${href}`).toBe(true);
    }
  });

  it('7. names no persona, flows or operator screen (AC-M5b)', () => {
    const { container } = renderPage();
    const text = (container.textContent ?? '').toLowerCase();
    expect(text).not.toMatch(/persona screen|flows screen|operator screen/);
  });
});

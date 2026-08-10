/**
 * Blog (`/blog`) — risk-based tests (qa-verify §4, amended 2026-07-13).
 *
 * What earns a TEST here (invariants / silent regressions):
 *  - the article HREFS: each card must point at the exact static file `docs/blog/build_html.py`
 *    emits into `public/blog/` — a drifted slug 404s in prod while the suite stays green (the
 *    classic silent regression), so the slug↔href contract is pinned.
 *  - ZERO network on mount (the static-page discipline shared with Scanner): the page must not
 *    imply it is fetching anything.
 *  - full-document anchors, NOT SPA navigation: the articles are standalone HTML documents; a
 *    RouterLink would try to resolve them client-side and render the 404 shell.
 * What is deliberately NOT tested (visible/intentional → review): titles, descriptions, tag copy,
 * ordering, the header prose.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BLOG_ARTICLES, BlogPage } from './BlogPage';

describe('BlogPage (/blog)', () => {
  const fetchSpy = vi.fn();
  let origFetch: typeof globalThis.fetch;

  beforeEach(() => {
    origFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = origFetch;
    fetchSpy.mockClear();
  });

  it('renders one card per article, each a plain full-document anchor to the emitted static file', () => {
    render(
      <MemoryRouter>
        <BlogPage />
      </MemoryRouter>,
    );
    for (const a of BLOG_ARTICLES) {
      const card = screen.getByTestId(`blog-card-${a.slug}`);
      const anchor = card.querySelector('a');
      expect(anchor).not.toBeNull();
      // The href contract: exactly /blog/<slug>.html — the file build_html.py emits.
      expect(anchor).toHaveAttribute('href', `/blog/${a.slug}.html`);
    }
  });

  it('features exactly the published methodology article (a second is a deliberate edit, not drift)', () => {
    expect(BLOG_ARTICLES.map((a) => a.slug)).toEqual(['how-we-read-dealer-structure']);
  });

  it('does ZERO network work on mount (static index discipline)', () => {
    render(
      <MemoryRouter>
        <BlogPage />
      </MemoryRouter>,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

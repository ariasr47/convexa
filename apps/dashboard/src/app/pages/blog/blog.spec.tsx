/**
 * Blog (`/blog` and `/blog/<slug>.html`) — risk-based tests.
 *
 * What earns a TEST here (silent regressions):
 *  - Zero data edge: a strict fetch harness (throws on any non-auth call) and zero `EventSource`, on
 *    the index and on a post.
 *  - No dead link and no lost post: every published post has its markdown source, its plain
 *    no-JavaScript copy, and NO static file at `public/blog/<slug>.html` — one there would win over
 *    the in-shell route, and the post would silently lose the bar, nav and footer.
 *  - An address that is not a published post renders the 404 it is handed, never an empty page.
 * What is deliberately NOT tested (visible → review): copy, card layout, the schematics' look.
 */
import { render, screen } from '@testing-library/react';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlogPage } from './BlogPage';
import { BlogPostPage } from './BlogPostPage';
import { BLOG_ARTICLES, postBlocks, postPath } from './posts';

function workspaceRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'nx.json'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('nx workspace root not found from ' + process.cwd());
}

let fetchMock: ReturnType<typeof vi.fn>;
let openedEventSources = 0;

beforeEach(() => {
  openedEventSources = 0;
  class SilentEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    constructor() {
      openedEventSources += 1;
    }
    close() {
      /* no-op */
    }
  }
  vi.stubGlobal('EventSource', SilentEventSource as unknown as typeof EventSource);
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    throw new Error(`Unexpected fetch from the blog: ${String(input)}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Blog', () => {
  it('the index and a post issue no fetch and open no EventSource', () => {
    const slug = BLOG_ARTICLES[0].slug;
    render(
      <MemoryRouter>
        <BlogPage />
        <BlogPostPage file={`${slug}.html`} notFound={<p>404</p>} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId(`blog-post-${slug}`)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(openedEventSources).toBe(0);
  });

  it('each card links to its post inside the shell', () => {
    render(
      <MemoryRouter>
        <BlogPage />
      </MemoryRouter>,
    );
    for (const a of BLOG_ARTICLES) {
      const anchor = screen.getByTestId(`blog-card-${a.slug}`).querySelector('a');
      expect(anchor).toHaveAttribute('href', postPath(a.slug));
    }
  });

  it('every published post has its source and plain copy, and no static file shadows its route', () => {
    const root = workspaceRoot();
    for (const a of BLOG_ARTICLES) {
      expect(postBlocks(a.slug)?.length, a.slug).toBeGreaterThan(0);
      expect(existsSync(resolve(root, 'docs', 'blog', `${a.slug}.md`))).toBe(true);
      expect(
        existsSync(resolve(root, 'apps', 'dashboard', 'public', 'blog', 'plain', `${a.slug}.html`)),
      ).toBe(true);
      expect(
        existsSync(resolve(root, 'apps', 'dashboard', 'public', 'blog', `${a.slug}.html`)),
      ).toBe(false);
    }
  });

  it('an address that is not a published post renders the 404 it is handed', () => {
    render(
      <MemoryRouter>
        <BlogPostPage file="how-we-read-gamma.html" notFound={<p data-testid="nf">404</p>} />
        <BlogPostPage file={BLOG_ARTICLES[0].slug} notFound={<p data-testid="nf2">404</p>} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('nf')).toBeInTheDocument();
    // The slug without .html is not the post's address either.
    expect(screen.getByTestId('nf2')).toBeInTheDocument();
  });
});

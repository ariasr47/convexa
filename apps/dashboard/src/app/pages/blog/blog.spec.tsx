/**
 * Blog (`/blog`, and a post at `/blog/<slug>` or its older `/blog/<slug>.html`) — risk-based tests.
 *
 * What earns a TEST here (silent regressions):
 *  - Zero data edge: a strict fetch harness (throws on any non-auth call) and zero `EventSource`, on
 *    the index and on a post.
 *  - No dead link and no lost post: every published post has its markdown source, its plain
 *    no-JavaScript copy, and NO static file at `public/blog/<slug>.html` — one there would win over
 *    the in-shell route, and the post would silently lose the bar, nav and footer.
 *  - Both addresses of a post render it (W1-06: every bookmark and share uses the bare one, and
 *    browsers cache Cloudflare's .html → bare 308); an address that is not a published post renders
 *    the 404 it is handed, never an empty page.
 *  - The post list (docs/blog/posts.json) parses: a malformed entry is left out, never half-built.
 * What is deliberately NOT tested (visible → review): copy, card layout, the schematics' look.
 */
import { render, screen } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlogPage } from './BlogPage';
import { BlogPostPage } from './BlogPostPage';
import { BLOG_ARTICLES, parsePostList, postBlocks, postPath, postSlugOf } from './posts';

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

  it('both addresses of a post render it; an address that is not a published post renders the 404', () => {
    const slug = BLOG_ARTICLES[0].slug;
    for (const file of [slug, `${slug}.html`]) {
      const { unmount } = render(
        <MemoryRouter initialEntries={[`/blog/${file}`]}>
          <BlogPostPage file={file} notFound={<p data-testid="nf">404</p>} />
        </MemoryRouter>,
      );
      expect(screen.getByTestId(`blog-post-${slug}`), file).toBeInTheDocument();
      expect(screen.queryByTestId('nf'), file).toBeNull();
      unmount();
    }
    for (const file of [
      'how-we-read-gamma.html',
      'how-we-read-gamma',
      `${slug}.htm`,
      '.html',
      '',
    ]) {
      const { unmount } = render(
        <MemoryRouter>
          <BlogPostPage file={file} notFound={<p data-testid="nf">404</p>} />
        </MemoryRouter>,
      );
      expect(screen.getByTestId('nf'), JSON.stringify(file)).toBeInTheDocument();
      unmount();
    }
  });

  it('a post address resolves to its slug, with or without .html, and nothing else does', () => {
    const slug = BLOG_ARTICLES[0].slug;
    expect(postSlugOf(slug)).toBe(slug);
    expect(postSlugOf(`${slug}.html`)).toBe(slug);
    expect(postSlugOf(`${slug}.html.html`)).toBeNull();
    expect(postSlugOf(`${slug.toUpperCase()}`)).toBeNull();
    expect(postSlugOf('plain')).toBeNull();
    expect(postPath(slug)).toBe(`/blog/${slug}`);
  });

  it('the post list keeps well-formed entries in order and leaves out malformed ones', () => {
    const ok = { slug: 'a-post', title: 'A', description: 'D', tag: 'T', cardFigure: null };
    expect(parsePostList(JSON.stringify([ok]))).toEqual([ok]);
    // cardFigure may be omitted (no schematic on the card).
    const noFigure = { slug: ok.slug, title: ok.title, description: ok.description, tag: ok.tag };
    expect(parsePostList(JSON.stringify([noFigure]))).toEqual([ok]);
    for (const bad of [
      { ...ok, slug: 'Bad Slug' },
      { ...ok, slug: '../x' },
      { ...ok, title: '' },
      { ...ok, description: 3 },
      { ...ok, tag: undefined },
      { ...ok, cardFigure: 'no-such-figure' },
      null,
    ]) {
      expect(parsePostList(JSON.stringify([bad, ok])), JSON.stringify(bad)).toEqual([ok]);
    }
    expect(parsePostList(JSON.stringify([ok, { ...ok, title: 'dup' }]))).toEqual([ok]);
    expect(parsePostList('not json')).toEqual([]);
    expect(parsePostList('{}')).toEqual([]);
    // The shipped list is well formed throughout: nothing in it was left out.
    const raw = readFileSync(resolve(workspaceRoot(), 'docs', 'blog', 'posts.json'), 'utf8');
    expect(BLOG_ARTICLES.length).toBe((JSON.parse(raw) as unknown[]).length);
    expect(BLOG_ARTICLES.length).toBeGreaterThan(0);
  });
});

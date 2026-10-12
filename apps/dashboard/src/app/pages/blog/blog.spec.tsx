/**
 * Blog (`/blog`) — risk-based tests (SPEC §7 item 4; PLAN.md F8).
 *
 * What earns a TEST here (invariants / silent regressions):
 *  - Zero data edge: the strict fetch harness, copied in SHAPE from `landing.spec.tsx:57-63`
 *    (throws on any non-auth call) and `:137-141` (zero `EventSource`), extended to this page
 *    per SPEC §7 item 4 — an accidental trader/bundle fetch added to the blog index fails every
 *    test in this file.
 *  - AC-B3: no link on the page leads to a blog document that does not exist — the href
 *    contract (ends `.html`, matches the emitted slug) AND the target file's actual presence on
 *    disk under `public/blog/`.
 *  - Full-document anchors, NOT SPA navigation: the articles are standalone HTML documents; a
 *    RouterLink would try to resolve them client-side and render the 404 shell.
 * What is deliberately NOT tested (visible/intentional → review): the card count and draft-slot
 * absence (AC-B1), the `<h1>` heading, the dek/tag copy wording, the intro sentence wording,
 * ordering, the header prose.
 */
import { render, screen } from '@testing-library/react';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BLOG_ARTICLES, BlogPage } from './BlogPage';

/** Walks up from cwd to the Nx workspace root — same idiom as the app's `.structural.spec.ts`
 *  files (e.g. `research-lab-surface.structural.spec.ts:14-21`), duplicated here on purpose so
 *  this colocated spec stays self-contained (no cross-page import). */
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

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

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

  // STRICT mock: only the app-wide who-am-I read is allowed; ANY trader/bundle call throws, so the
  // "zero data edge" invariant is enforced by construction (SPEC §7 item 4).
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/auth/session')) {
      return json({ authenticated: false, user: null, google_available: false, settings: null });
    }
    throw new Error(`Unexpected fetch from BlogPage: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Any NON-AUTH fetch? Mirrors `landing.spec.tsx`'s helper — the who-am-I read is excluded. */
function calledNonAuth(): boolean {
  return fetchMock.mock.calls.some((c) => !String(c[0]).includes('/api/auth/'));
}

function renderBlog() {
  return render(
    <MemoryRouter>
      <BlogPage />
    </MemoryRouter>,
  );
}

describe('BlogPage (/blog)', () => {
  it('issues no non-auth fetch and opens no EventSource on mount (SPEC §7 item 4)', () => {
    renderBlog();
    expect(calledNonAuth()).toBe(false);
    expect(openedEventSources).toBe(0);
  });

  it('each card is a plain full-document anchor whose href ends .html (SPEC §4)', () => {
    renderBlog();
    for (const a of BLOG_ARTICLES) {
      const card = screen.getByTestId(`blog-card-${a.slug}`);
      const anchor = card.querySelector('a');
      expect(anchor).not.toBeNull();
      // The href contract: exactly /blog/<slug>.html — the file build_html.py emits.
      expect(anchor).toHaveAttribute('href', `/blog/${a.slug}.html`);
      expect(anchor?.getAttribute('href')).toMatch(/\.html$/);
    }
  });

  it('every card href resolves to a file that actually exists on disk (AC-B3)', () => {
    const root = workspaceRoot();
    for (const a of BLOG_ARTICLES) {
      const target = resolve(root, 'apps', 'dashboard', 'public', 'blog', `${a.slug}.html`);
      expect(existsSync(target), target).toBe(true);
    }
  });
});

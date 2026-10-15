/**
 * The published posts. Order = display order. Owner ruling D-A = (A) (SPEC §1): published posts
 * only, no draft slots — a post is published by being listed in `docs/blog/posts.json`.
 *
 * That list is the one source of each post's slug, title and description, read three ways: here at
 * build time (the glob below bundles it; nothing is fetched), by `tools/write-blog-heads.mjs` for the
 * post's own <title>, canonical and share tags, and by `docs/blog/build_html.py` for the plain copy.
 * Each post's text is its one source, `docs/blog/<slug>.md`, read here the same way.
 *
 * The post renders inside the shell at `/blog/<slug>` (postPath). `/blog/<slug>.html`, the address
 * it had before, still opens it: Cloudflare 308-redirects a `.html` address to the bare one, and
 * browsers cache that redirect, so both forms must render the post (W1-06). `docs/blog/build_html.py`
 * writes the plain no-JavaScript copy of the same file to `/blog/plain/<slug>.html`.
 */
import { parseMarkdown, type Block } from './markdown';

export interface BlogArticle {
  slug: string;
  title: string;
  description: string;
  tag: string;
  /** The schematic the index card shows (Schematics.tsx), by its docs/blog/img name. */
  cardFigure: 'walls-and-flip' | null;
}

const LIST = import.meta.glob('../../../../../../docs/blog/posts.json', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FIGURES: readonly BlogArticle['cardFigure'][] = ['walls-and-flip', null];

/** The list's entries that are well formed; an entry that is not is left out rather than rendered
 *  half-built (the build's head step refuses the same entry loudly, so it never ships unseen). */
export function parsePostList(raw: string): BlogArticle[] {
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  const out: BlogArticle[] = [];
  for (const e of list as Record<string, unknown>[]) {
    if (!e || typeof e !== 'object') continue;
    const { slug, title, description, tag } = e;
    const cardFigure = e.cardFigure ?? null;
    if (typeof slug !== 'string' || !SLUG.test(slug)) continue;
    if (typeof title !== 'string' || !title.trim()) continue;
    if (typeof description !== 'string' || !description.trim()) continue;
    if (typeof tag !== 'string' || !tag.trim()) continue;
    if (!FIGURES.includes(cardFigure as BlogArticle['cardFigure'])) continue;
    if (out.some((a) => a.slug === slug)) continue;
    out.push({
      slug,
      title,
      description,
      tag,
      cardFigure: cardFigure as BlogArticle['cardFigure'],
    });
  }
  return out;
}

export const BLOG_ARTICLES: readonly BlogArticle[] = parsePostList(Object.values(LIST)[0] ?? '[]');

const SOURCES = import.meta.glob('../../../../../../docs/blog/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** The address a post lives at, inside the shell. */
export const postPath = (slug: string) => `/blog/${slug}`;

/** The published post a `/blog/:file` address names — its slug, with or without `.html` — or null.
 *  Nothing else under /blog/ is a post: not a draft, not a near miss, not `plain/…`. */
export function postSlugOf(file: string): string | null {
  const slug = file.endsWith('.html') ? file.slice(0, -'.html'.length) : file;
  return BLOG_ARTICLES.some((a) => a.slug === slug) ? slug : null;
}

/** The post's blocks, without its own `# title` and the italic dek under it (the page draws both
 *  from BLOG_ARTICLES), or null when no published post has this slug. */
export function postBlocks(slug: string): Block[] | null {
  if (!BLOG_ARTICLES.some((a) => a.slug === slug)) return null;
  const source = Object.entries(SOURCES).find(([path]) => path.endsWith(`/${slug}.md`))?.[1];
  if (source === undefined) return null;
  const blocks = parseMarkdown(source);
  const start = blocks.findIndex((b) => b.kind === 'h2');
  return start === -1 ? blocks : blocks.slice(start);
}

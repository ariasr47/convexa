/**
 * The published posts. Order = display order. Owner ruling D-A = (A) (SPEC §1): published posts
 * only, no draft slots — a post is published by being listed here.
 *
 * Each post's text is its one source, `docs/blog/<slug>.md`, read at build time (the glob below
 * bundles it; nothing is fetched). The post renders inside the shell at `/blog/<slug>.html`, the
 * address it has always had; `docs/blog/build_html.py` writes the plain no-JavaScript copy of the
 * same file to `/blog/plain/<slug>.html`.
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

export const BLOG_ARTICLES: readonly BlogArticle[] = [
  {
    slug: 'how-we-read-dealer-structure',
    title: 'How We Read Dealer Structure',
    description:
      'Walls, the gamma flip, GEX, score, and two data speeds — what Convexa actually computes, ' +
      'on what basis, and where the read is weak.',
    tag: 'Methodology',
    cardFigure: 'walls-and-flip',
  },
];

const SOURCES = import.meta.glob('../../../../../../docs/blog/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** The address a post lives at, inside the shell. */
export const postPath = (slug: string) => `/blog/${slug}.html`;

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

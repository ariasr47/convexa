/**
 * Blog (`/blog`) — the v2 index composition over the ONE published read (SPEC §4 "Blog index";
 * PLAN.md F8). In the shell, but does ZERO data work: no fetch, no SSE, no compute (the deny-list
 * `eslint.config.mjs` `pages/blog/**` bans `@convexa/api` at build time — SPEC §2.1's zero-edge
 * tree). Each card links to a self-contained static article at `/blog/<slug>.html` (emitted by
 * `docs/blog/build_html.py` into `public/blog/` — the script is the sync step, so the SPA never
 * renders markdown at runtime).
 *
 * The links are plain full-document anchors ON PURPOSE — the articles are standalone HTML documents
 * served by the static host, not SPA routes; a RouterLink would try (and fail) to resolve them
 * client-side. Token-only styling (`[theme-token-discipline]`): zero hardcoded hex.
 *
 * The index stays a FLAT ARRAY of published articles. Owner ruling D-A = (A), 2026-09-10 (SPEC
 * §1): the index ships the one published read and NO draft slots — the `published | draft`
 * discriminated union has no member to discriminate this phase and is deliberately not built; §1's
 * restoring condition is the only thing that puts it back.
 */
import { extrasFor } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect } from 'react';
import { BLOG_COPY } from './copy';

interface BlogArticle {
  slug: string;
  title: string;
  description: string;
  tag: string;
}

/** The published articles. Order = display order. Slugs must match `docs/blog/build_html.py`.
 *  Owner ruling D-A = (A) (SPEC §1): one published read, no draft slots this phase. */
export const BLOG_ARTICLES: BlogArticle[] = [
  {
    slug: 'how-we-read-dealer-structure',
    title: 'How We Read Dealer Structure',
    description:
      'Walls, the gamma flip, GEX, score, and two data speeds — what Convexa actually computes, ' +
      'on what basis, and where the read is weak.',
    tag: 'Methodology',
  },
];

export function BlogPage() {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Blog — Convexa';
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto', p: 3 }} data-testid="blog-page">
      <Stack spacing={1} sx={{ my: 4 }}>
        <Typography
          variant="overline"
          component="p"
          sx={(theme) => ({ color: extrasFor(theme).textAmber, letterSpacing: '0.12em', m: 0 })}
        >
          {BLOG_COPY.eyebrow}
        </Typography>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
          {BLOG_COPY.heading}
        </Typography>
        <Typography
          variant="body1"
          sx={{ color: 'text.secondary', maxWidth: 680, lineHeight: 1.6 }}
        >
          {BLOG_COPY.intro}
        </Typography>
      </Stack>

      <Stack spacing={2.5}>
        {BLOG_ARTICLES.map((a) => (
          <Card key={a.slug} variant="outlined" data-testid={`blog-card-${a.slug}`}>
            <CardActionArea component="a" href={`/blog/${a.slug}.html`} sx={{ p: 3 }}>
              <Stack spacing={1}>
                <Box>
                  <Chip label={a.tag} size="small" variant="outlined" sx={{ mb: 1 }} />
                </Box>
                <Typography variant="h6" component="h2" sx={{ lineHeight: 1.3 }}>
                  {a.title}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {a.description}
                </Typography>
                <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600 }}>
                  {BLOG_COPY.readPost}
                </Typography>
              </Stack>
            </CardActionArea>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}

export default BlogPage;

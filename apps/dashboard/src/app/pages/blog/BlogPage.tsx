/**
 * Blog (`/blog`) — static index of the engineering blog. In the shell, but does ZERO data work:
 * no fetch, no SSE, no compute (the Scanner placeholder's discipline). Each card links to a
 * self-contained static article at `/blog/<slug>.html` (emitted by `docs/blog/build_html.py` into
 * `public/blog/` — the script is the sync step, so the SPA never renders markdown at runtime).
 *
 * The links are plain full-document anchors ON PURPOSE — the articles are standalone HTML documents
 * served by the static host, not SPA routes; a RouterLink would try (and fail) to resolve them
 * client-side. Token-only styling (`[theme-token-discipline]`): zero hardcoded hex.
 */
import { useEffect } from 'react';
import { Box, Card, CardActionArea, Chip, Stack, Typography } from '@mui/material';

interface BlogArticle {
  slug: string;
  title: string;
  description: string;
  tag: string;
}

/** The featured articles. Order = display order. Slugs must match `docs/blog/build_html.py`. */
export const BLOG_ARTICLES: BlogArticle[] = [
  {
    slug: 'building-a-team-of-ai-roles',
    title: "We Didn't Hire a Team. We Built One — Out of AI Sessions.",
    description:
      'How Convexa ships software using a relay of role-playing AI sessions, a shared rulebook, ' +
      'and a habit of squeezing every conversation down to just its decisions.',
    tag: 'How we build',
  },
  {
    slug: 'system-analysis',
    title: 'System Analysis — the team-of-AI-roles as a solo-dev build tool',
    description:
      'The candid, living self-analysis behind the story: what the delivery system actually is, ' +
      "what's load-bearing, where it fails, and what's next. Unvarnished — weaknesses included.",
    tag: 'Deep dive',
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
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
          Blog
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          How Convexa is built — a small studio of role-playing AI sessions, and the candid
          engineering notes behind it.
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
                  Read the post →
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

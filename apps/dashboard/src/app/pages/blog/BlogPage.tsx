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
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect } from 'react';

interface BlogArticle {
  slug: string;
  title: string;
  description: string;
  tag: string;
}

/** The featured articles. Order = display order. Slugs must match `docs/blog/build_html.py`. */
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
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
          Blog
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          How we read the options book — dealer structure, score honesty, and the two clocks on the
          desk. Longer form of the in-app Methodology page.
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

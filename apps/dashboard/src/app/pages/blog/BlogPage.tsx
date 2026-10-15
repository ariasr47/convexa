/**
 * Blog (`/blog`) — the index of published posts (posts.ts). In the shell, and does ZERO data work:
 * no fetch, no SSE (the deny-list `eslint.config.mjs` `pages/blog/**` bans `@convexa/api` — SPEC
 * §2.1's zero-edge tree). Each card links to the post inside the shell at `/blog/<slug>.html`.
 *
 * Owner ruling D-A = (A), 2026-09-10 (SPEC §1): published posts only, never a draft slot; with
 * none, the page says so.
 *
 * Design: design/src/screens/final/shell-site-docs.mjs (blogIndexBoard, blogStates).
 */
import { extrasFor } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { BLOG_COPY } from './copy';
import { BLOG_ARTICLES, postPath, type BlogArticle } from './posts';
import { LevelsSchematic } from './Schematics';

export function BlogIndex({ articles }: { articles: readonly BlogArticle[] }) {
  return (
    <Box
      sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 3, md: 5 } }}
      data-testid="blog-page"
    >
      <Stack spacing={1.25} sx={{ mb: 3 }}>
        <Typography
          component="p"
          sx={{
            m: 0,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'text.secondary',
          }}
        >
          {BLOG_COPY.eyebrow}
        </Typography>
        <Typography
          variant="h4"
          component="h1"
          sx={{ fontWeight: 700, letterSpacing: '-0.01em', m: 0 }}
        >
          {BLOG_COPY.heading}
        </Typography>
        <Typography
          variant="body1"
          sx={{ color: 'text.secondary', maxWidth: '62ch', lineHeight: 1.6, m: 0 }}
        >
          {BLOG_COPY.intro}
        </Typography>
      </Stack>

      {articles.length === 0 ? (
        <Box
          data-testid="blog-empty"
          sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2, p: 3 }}
        >
          <Typography component="p" sx={{ fontWeight: 700, m: 0 }}>
            {BLOG_COPY.emptyTitle}
          </Typography>
          <Typography component="p" sx={{ color: 'text.secondary', m: 0, mt: 0.5 }}>
            {BLOG_COPY.emptyBody}
          </Typography>
        </Box>
      ) : (
        <Stack spacing={2.5}>
          {articles.map((a) => (
            <Card key={a.slug} variant="outlined" data-testid={`blog-card-${a.slug}`}>
              <CardActionArea
                component={RouterLink}
                to={postPath(a.slug)}
                sx={{ p: { xs: 2, sm: 3 } }}
              >
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
                    gap: 3,
                    alignItems: 'center',
                  }}
                >
                  <Stack spacing={1.25} sx={{ minWidth: 0 }}>
                    <Box>
                      <Chip label={a.tag} size="small" variant="outlined" />
                    </Box>
                    <Typography
                      variant="h5"
                      component="h2"
                      sx={{ lineHeight: 1.2, fontWeight: 700 }}
                    >
                      {a.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {a.description}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: (theme) => extrasFor(theme).textInfo, fontWeight: 600 }}
                    >
                      {BLOG_COPY.readPost}
                    </Typography>
                  </Stack>
                  {a.cardFigure === 'walls-and-flip' && (
                    <Box component="figure" sx={{ m: 0, minWidth: 0 }} aria-hidden>
                      <LevelsSchematic />
                      <Box
                        component="figcaption"
                        sx={{ mt: 1, fontSize: 12, color: 'text.secondary' }}
                      >
                        {BLOG_COPY.schematic}
                      </Box>
                    </Box>
                  )}
                </Box>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}
      {articles.length > 0 && (
        <Typography component="p" sx={{ color: 'text.secondary', fontSize: 13, mt: 2.5, mb: 0 }}>
          {articles.length === 1 ? BLOG_COPY.onePost : BLOG_COPY.morePosts}
        </Typography>
      )}
    </Box>
  );
}

export function BlogPage() {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Blog — Convexa';
    return () => {
      document.title = prev;
    };
  }, []);
  return <BlogIndex articles={BLOG_ARTICLES} />;
}

export default BlogPage;

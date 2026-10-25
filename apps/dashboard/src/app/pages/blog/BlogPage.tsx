/**
 * Blog (`/blog`) — the index of published posts (posts.ts). In the shell, and does ZERO data work:
 * no fetch, no SSE (the deny-list `eslint.config.mjs` `pages/blog/**` bans `@convexa/api` — SPEC
 * §2.1's zero-edge tree). Each card links to the post inside the shell at `/blog/<slug>.html`.
 *
 * Owner ruling D-A = (A), 2026-09-10 (SPEC §1): published posts only, never a draft slot; with
 * none, the page says so.
 *
 * Design: design/src/screens/final/shell-site-docs.mjs (blogIndexBoard, blogStates): the page
 * column capped at 1100, a caps eyebrow, the H1 at clamp(32px, 3.4vw, 44px), a 16px lead, and each
 * card a panel padded 24 with a 28px Archivo title and its schematic in the `.ss-schem` frame
 * (fidelity audit 2026-10-25, SITE-12).
 */
import { extrasFor, typographyTokens } from '@/shared/theme/tokens';
import { pageColumnSx } from '@/shared/ui/PageColumn';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { BLOG_COPY } from './copy';
import { BLOG_ARTICLES, postPath, type BlogArticle } from './posts';
import { LevelsSchematic, SchematicFrame } from './Schematics';

const DISPLAY = {
  fontFamily: typographyTokens.displayFontFamily,
  fontStretch: typographyTokens.displayFontStretch,
  fontWeight: 700,
  letterSpacing: '-0.01em',
} as const;
/** The board's solid tag (`.stag.k-solid`): 22px, 11/600, a strong hairline, no fill. */
const TAG_SX = {
  alignSelf: 'flex-start',
  display: 'inline-flex',
  alignItems: 'center',
  height: 22,
  px: 1,
  borderRadius: '999px',
  border: '1px solid',
  borderColor: (t: Parameters<typeof extrasFor>[0]) => extrasFor(t).lineStrong,
  fontSize: 11,
  fontWeight: 600,
  lineHeight: 1,
  whiteSpace: 'nowrap',
  color: 'text.primary',
} as const;

export function BlogIndex({ articles }: { articles: readonly BlogArticle[] }) {
  return (
    <Box
      // The page column (`.wrap`) capped at the board's 1100: 1020px of content at x210 on a 1440
      // screen. Everything inside sits on the board's 24px rhythm.
      sx={{
        ...pageColumnSx,
        maxWidth: 1100,
        pt: 5,
        pb: { xs: 3, md: 5 },
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
      data-testid="blog-page"
    >
      <Stack spacing={1.25}>
        <Typography
          component="p"
          sx={{
            m: 0,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.06em',
            lineHeight: 1.3,
            textTransform: 'uppercase',
            color: 'text.secondary',
          }}
        >
          {BLOG_COPY.eyebrow}
        </Typography>
        <Typography
          component="h1"
          sx={{
            ...DISPLAY,
            fontSize: 'clamp(32px, 3.4vw, 44px)',
            lineHeight: 1.1,
            textWrap: 'balance',
            m: 0,
          }}
        >
          {BLOG_COPY.heading}
        </Typography>
        <Typography
          component="p"
          sx={{ color: 'text.secondary', maxWidth: '62ch', fontSize: 16, lineHeight: 1.6, m: 0 }}
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
        <Stack spacing={3}>
          {articles.map((a) => (
            <Card
              key={a.slug}
              variant="outlined"
              data-testid={`blog-card-${a.slug}`}
              sx={{ borderRadius: '12px' }}
            >
              <CardActionArea component={RouterLink} to={postPath(a.slug)} sx={{ p: 3 }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
                    gap: 3,
                    alignItems: 'center',
                  }}
                >
                  <Stack spacing={1.25} sx={{ minWidth: 0 }}>
                    <Box component="span" sx={TAG_SX}>
                      {a.tag}
                    </Box>
                    <Typography
                      component="h2"
                      sx={{ ...DISPLAY, fontSize: 28, lineHeight: 1.15, m: 0 }}
                    >
                      {a.title}
                    </Typography>
                    <Typography
                      component="p"
                      sx={{ m: 0, fontSize: 14.5, lineHeight: 1.45, color: 'text.secondary' }}
                    >
                      {a.description}
                    </Typography>
                    <Typography
                      component="p"
                      sx={{
                        m: 0,
                        fontSize: 14,
                        color: (theme) => extrasFor(theme).textInfo,
                        fontWeight: 600,
                      }}
                    >
                      {BLOG_COPY.readPost}
                    </Typography>
                  </Stack>
                  {a.cardFigure === 'walls-and-flip' && (
                    <SchematicFrame caption={BLOG_COPY.schematic} hidden>
                      <LevelsSchematic height={170} />
                    </SchematicFrame>
                  )}
                </Box>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}
      {articles.length > 0 && (
        <Typography
          component="p"
          sx={{ color: 'text.secondary', fontSize: 12, lineHeight: 1.45, m: 0 }}
        >
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

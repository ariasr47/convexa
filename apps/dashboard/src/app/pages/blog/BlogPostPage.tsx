/**
 * A blog post (`/blog/<slug>`, or the older `/blog/<slug>.html`), inside the shell: the site's bar, nav and footer, a back link
 * to /blog, the post's tag, title and dek, then its text from `docs/blog/<slug>.md` (posts.ts).
 * Static: no fetch, no SSE (the `pages/blog/**` deny-list bans the API client). An address that is
 * not a published post renders `notFound` — the site's own 404, passed in by the route table since
 * pages never import each other.
 *
 * Design: design/src/screens/final/shell-site-docs.mjs (blogPostBoard).
 */
import { extrasFor, typographyTokens } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useEffect, type ReactNode } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { BLOG_COPY } from './copy';
import { parseInline, type Block } from './markdown';
import { BLOG_ARTICLES, postBlocks, postPath, postSlugOf } from './posts';
import { Schematic } from './Schematics';

const linkSx = { color: (t: Parameters<typeof extrasFor>[0]) => extrasFor(t).textInfo } as const;
const DISPLAY = {
  fontFamily: typographyTokens.displayFontFamily,
  fontStretch: typographyTokens.displayFontStretch,
} as const;

function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((part, i) => {
        switch (part.kind) {
          case 'code':
            return (
              <Box
                key={i}
                component="code"
                sx={(t) => ({
                  fontFamily: typographyTokens.monoFontFamily,
                  fontSize: '0.92em',
                  px: 0.5,
                  borderRadius: 0.5,
                  bgcolor: extrasFor(t).well,
                })}
              >
                {part.text}
              </Box>
            );
          case 'strong':
            return <strong key={i}>{part.text}</strong>;
          case 'em':
            return <em key={i}>{part.text}</em>;
          case 'link':
            return part.href.startsWith('/') ? (
              <Link key={i} component={RouterLink} to={part.href} sx={linkSx}>
                {part.text}
              </Link>
            ) : (
              <Link key={i} href={part.href} sx={linkSx}>
                {part.text}
              </Link>
            );
          default:
            return <span key={i}>{part.text}</span>;
        }
      })}
    </>
  );
}

function BlockView({ block }: { block: Block }): ReactNode {
  switch (block.kind) {
    case 'h1':
    case 'h2':
      return (
        <Typography
          component="h2"
          sx={{
            ...DISPLAY,
            fontSize: { xs: 22, sm: 24 },
            fontWeight: 700,
            mt: 5,
            mb: 1.5,
            lineHeight: 1.25,
          }}
        >
          <Inline text={block.text} />
        </Typography>
      );
    case 'h3':
      return (
        <Typography component="h3" sx={{ fontSize: 17, fontWeight: 700, mt: 3, mb: 1 }}>
          <Inline text={block.text} />
        </Typography>
      );
    case 'p':
      return (
        <Typography component="p" sx={{ fontSize: 16, lineHeight: 1.7, m: 0, mb: 2 }}>
          <Inline text={block.text} />
        </Typography>
      );
    case 'ul':
    case 'ol':
      return (
        <Box component={block.kind} sx={{ m: 0, mb: 2, pl: 3, fontSize: 16, lineHeight: 1.7 }}>
          {block.items.map((item, i) => (
            <Box component="li" key={i} sx={{ my: 0.75 }}>
              <Inline text={item} />
            </Box>
          ))}
        </Box>
      );
    case 'quote':
      return (
        <Box
          component="blockquote"
          sx={{
            m: 0,
            my: 3,
            pl: 2,
            borderLeft: '3px solid',
            borderColor: 'text.secondary',
            color: 'text.secondary',
            fontSize: 16,
            lineHeight: 1.7,
          }}
        >
          <Inline text={block.text} />
        </Box>
      );
    case 'table':
      return (
        <Box sx={{ overflowX: 'auto', my: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {block.head.map((h) => (
                  <TableCell key={h} scope="col">
                    <Inline text={h} />
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {block.rows.map((row, r) => (
                <TableRow key={r}>
                  {row.map((cell, c) => (
                    <TableCell key={c}>
                      <Inline text={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      );
    case 'figure':
      return <Schematic name={block.name} caption={<Inline text={block.caption} />} />;
    case 'hr':
      // Sections are already set apart by their headings.
      return null;
  }
}

export function BlogPostPage({ file, notFound }: { file: string; notFound: ReactNode }) {
  const slug = postSlugOf(file);
  const article = slug ? BLOG_ARTICLES.find((a) => a.slug === slug) : undefined;
  const blocks = slug ? postBlocks(slug) : null;
  const navigate = useNavigate();
  const { search, hash } = useLocation();

  // `/blog/<slug>.html` is the post's older address (bookmarks, and browsers holding Cloudflare's
  // cached .html → bare 308). It renders the post, and the address bar settles on the one canonical
  // form. Client-side only: a server bare → .html rule would loop against those cached redirects.
  useEffect(() => {
    if (slug && file !== slug)
      navigate({ pathname: postPath(slug), search, hash }, { replace: true });
  }, [slug, file, search, hash, navigate]);

  useEffect(() => {
    if (!article) return;
    const prev = document.title;
    document.title = `${article.title} — Convexa`;
    return () => {
      document.title = prev;
    };
  }, [article]);

  if (!article || !blocks) return <>{notFound}</>;

  return (
    <Box
      component="article"
      data-testid={`blog-post-${article.slug}`}
      sx={{ maxWidth: 720, mx: 'auto', px: 2, py: { xs: 3, md: 5 } }}
    >
      <Link
        component={RouterLink}
        to="/blog"
        sx={{
          ...linkSx,
          display: 'inline-flex',
          alignItems: 'center',
          minHeight: 24,
          fontSize: 14,
          textDecoration: 'none',
        }}
        data-testid="blog-post-back"
      >
        ← All posts
      </Link>
      <Box
        sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mt: 3, mb: 1.5 }}
      >
        <Chip label={article.tag} size="small" variant="outlined" />
        <Typography component="span" sx={{ fontSize: 13, color: 'text.secondary' }}>
          {BLOG_COPY.eyebrow} · {BLOG_COPY.heading}
        </Typography>
      </Box>
      <Typography
        component="h1"
        sx={{
          ...DISPLAY,
          fontSize: { xs: 30, sm: 38 },
          fontWeight: 700,
          lineHeight: 1.15,
          m: 0,
          mb: 2,
        }}
      >
        {article.title}
      </Typography>
      <Typography component="p" sx={{ fontSize: 18, lineHeight: 1.6, m: 0, mb: 1 }}>
        {article.description}
      </Typography>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </Box>
  );
}

export default BlogPostPage;

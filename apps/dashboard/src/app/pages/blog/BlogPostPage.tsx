/**
 * A blog post (`/blog/<slug>`, or the older `/blog/<slug>.html`), inside the shell: the site's bar, nav and footer, a back link
 * to /blog, the post's tag, title and dek, then its text from `docs/blog/<slug>.md` (posts.ts).
 * Static: no fetch, no SSE (the `pages/blog/**` deny-list bans the API client). An address that is
 * not a published post renders `notFound` — the site's own 404, passed in by the route table since
 * pages never import each other.
 *
 * Design: design/src/screens/final/shell-site-docs.mjs (blogPostBoard), styled by `.ss-post` and
 * `.ss-schem` in shell-site-kit.mjs: a 72ch measure (562px of content), a flex column on an 18px
 * rhythm, the H1 at clamp(32px, 3.6vw, 46px) / 1.08, steel body with phosphor emphasis, and the
 * callout on the panel (fidelity audit 2026-10-25, SITE-11).
 */
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { extrasFor, typographyTokens } from '@/shared/theme/tokens';
import { proseLinkSx, standaloneLinkSx } from '@/shared/ui/touch';
import Box from '@mui/material/Box';
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

const DISPLAY = {
  fontFamily: typographyTokens.displayFontFamily,
  fontStretch: typographyTokens.displayFontStretch,
  fontWeight: 700,
  letterSpacing: '-0.01em',
  // The boards balance every heading (`h1, h2, h3 { text-wrap: balance }`, design/src/lib.mjs).
  textWrap: 'balance',
} as const;
/** Body copy is steel; the phrases the post bolds stay phosphor (`.ss-post p strong`). */
const BODY = {
  m: 0,
  fontSize: 16,
  lineHeight: 1.7,
  color: 'text.secondary',
  textWrap: 'pretty',
  '& strong': { color: 'text.primary' },
} as const;
/** The board's solid tag (`.stag.k-solid`): 22px, 11/600, a strong hairline, no fill. */
const TAG_SX = {
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
              <Link key={i} component={RouterLink} to={part.href} sx={proseLinkSx}>
                {part.text}
              </Link>
            ) : (
              <Link key={i} href={part.href} sx={proseLinkSx}>
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
          // 18px of margin on top of the column's 18px gap (`.ss-post h2`).
          sx={{ ...DISPLAY, fontSize: 24, lineHeight: 1.2, m: 0, mt: '18px' }}
        >
          <Inline text={block.text} />
        </Typography>
      );
    case 'h3':
      return (
        <Typography
          component="h3"
          sx={{ fontSize: 17, fontWeight: 700, m: 0, mt: '6px', textWrap: 'balance' }}
        >
          <Inline text={block.text} />
        </Typography>
      );
    case 'p':
      return (
        <Typography component="p" sx={BODY}>
          <Inline text={block.text} />
        </Typography>
      );
    case 'ul':
    case 'ol':
      return (
        <Box
          component={block.kind}
          sx={{ ...BODY, pl: '22px', display: 'flex', flexDirection: 'column', gap: '6px' }}
        >
          {block.items.map((item, i) => (
            <Box component="li" key={i}>
              <Inline text={item} />
            </Box>
          ))}
        </Box>
      );
    case 'quote':
      return (
        <Box
          component="blockquote"
          // The callout sits on the panel, phosphor on a strong left rule (`.ss-post blockquote`).
          sx={(t) => ({
            m: 0,
            py: '12px',
            px: 2,
            borderLeft: `2px solid ${extrasFor(t).lineStrong}`,
            borderRadius: '0 8px 8px 0',
            bgcolor: 'background.paper',
            color: 'text.primary',
            fontSize: 14.5,
            lineHeight: 1.6,
          })}
        >
          <Inline text={block.text} />
        </Box>
      );
    case 'table':
      return (
        <Box sx={{ overflowX: 'auto' }}>
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

  // An unknown slug renders NotFound, which sets its own title; never nest two calls on one route.
  useDocumentTitle(article ? `${article.title} — Convexa` : null);

  if (!article || !blocks) return <>{notFound}</>;

  return (
    <Box
      component="article"
      data-testid={`blog-post-${article.slug}`}
      // 594 = the 562px measure plus the 16px gutters, so the text column is the board's at every
      // width (the board centres a 72ch article inside the page column).
      sx={{
        maxWidth: 594,
        mx: 'auto',
        px: 2,
        pt: 5,
        pb: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
      }}
    >
      <Link
        component={RouterLink}
        to="/blog"
        // Standalone: 24px at a fine pointer, 44px under a coarse one (70x24 at 390 before; spec
        // 2026-10-21/02, part (b)).
        sx={{ ...standaloneLinkSx, alignSelf: 'flex-start', fontSize: 14, textDecoration: 'none' }}
        data-testid="blog-post-back"
      >
        ← All posts
      </Link>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '6px 14px',
          fontSize: 13,
          color: 'text.secondary',
        }}
      >
        <Box component="span" sx={TAG_SX}>
          {article.tag}
        </Box>
        <span>
          {BLOG_COPY.eyebrow} · {BLOG_COPY.heading}
        </span>
      </Box>
      <Typography
        component="h1"
        sx={{
          ...DISPLAY,
          fontSize: 'clamp(32px, 3.6vw, 46px)',
          lineHeight: 1.08,
          letterSpacing: '-0.02em',
          m: 0,
        }}
      >
        {article.title}
      </Typography>
      <Typography
        component="p"
        sx={{ fontSize: 18, lineHeight: 1.7, m: 0, color: 'text.primary', textWrap: 'pretty' }}
      >
        {article.description}
      </Typography>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </Box>
  );
}

export default BlogPostPage;

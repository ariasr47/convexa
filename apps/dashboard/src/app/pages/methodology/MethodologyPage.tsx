/**
 * `/methodology` — product spine #7 trust surface (SPEC §4 "Methodology"; PLAN.md F10).
 * STATIC: no fetch, no SSE, no store — `pages/methodology/**` is banned from importing
 * `@convexa/api` at build time (F1's deny-list, `eslint.config.mjs:206`). Renders inside
 * AppShell's `<main>`; this page does not nest a second main.
 *
 * The on-this-page index and the body are BOTH generated from the ONE ordered
 * `METHOD_COPY.sections` list (PLAN D1/D2) — they read the same array, so they cannot diverge.
 * Each section renders as `<Box component="section" id={section.id} aria-labelledby={...}>`
 * (AC-M1's stable deep-link anchor lives on the section wrapper, not the heading) with an
 * `<h2>`; each index entry is a plain `<a href={'/methodology#' + section.id}>` (native
 * fragment navigation, not a `RouterLink` — these never leave the page).
 *
 * GATE Z I-1 (AC-M6/AC-M1): `apps/dashboard/index.html:5` declares `<base href="/">`, and the
 * HTML fragment-resolution algorithm resolves a BARE `href="#id"` against that base, not against
 * the document's current path — so a bare hash landed the reader on `/#id` (the landing), never
 * on this page. An ABSOLUTE-PATH href (`/methodology#id`) is unaffected by `<base>` and, because
 * the browser recognises it as a same-document reference once already on `/methodology`, still
 * navigates natively (no reload, no RouterLink, no onClick override) — the plain-anchor
 * FRAGMENT-NAVIGATION property this file has always wanted stays true, the base-tag hazard just
 * needed an absolute path to be immune to it. jsdom implements no `<base>` resolution at all, so
 * `methodology.spec.tsx`'s render-level test never saw this (the bounced GATE Q finding); the
 * regression is covered by an e2e case instead
 * (`apps/dashboard-e2e/src/e2e/navigation.spec.ts`, "methodology on-page index").
 *
 * A FRESH load of `/methodology#id` has the same defect for a different reason: the browser's
 * own scroll-to-fragment step runs once, at navigation time, before this lazy route's chunk has
 * rendered the section elements — the id does not exist in the DOM yet, so the browser's own
 * attempt silently finds nothing and never retries. The effect below is the manual equivalent,
 * run once after mount.
 *
 * The on-this-page index is a plain VERTICAL list at every width, sticky above `md` (mirrors
 * `design/src/screens/methodology.mjs:6`'s `.toc { position: sticky }`), plain in-flow below —
 * PLAN's planner decision D2: the design's ≤899px horizontal scroller does NOT ship this phase
 * (`curvature-v2-responsive-sweep` owns the six responsive bands). The grid row is left at its
 * default `stretch` (not `start`) so the sticky column's containing block is as tall as the body
 * column — the exact hazard `CommandDeck.tsx`'s `deck-sticky-reveal` docblock names: a sticky
 * element can never render outside its own containing block's box, so a short containing block
 * gives the sticky nav nowhere to travel once scrolled past.
 *
 * Table blocks render a real `<table>`/`<thead>`/`<th scope="col">` (MUI's `TableCell` resolves
 * to `<th>` automatically inside `TableHead`; `scope="col"` is set explicitly, since MUI does
 * not add it). The vocabulary section's literal column renders `SANS_FACE`
 * (`@/shared/figure`) — never `MONO_FACE`, never a figure: on the one page that defines the
 * closed not-a-number vocabulary, a literal wearing the traced register would be the exact
 * inversion canon rule 24 exists to prevent.
 */
import { SANS_FACE } from '@/shared/figure';
import { extrasFor } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { METHOD_COPY, type MethodSection } from './copy';

/** Deep-link scroll clearance under the sticky `TopNav` (`{xs:56,md:60}` tall) plus breathing
 *  room — mirrors the design source's own `top: 76px` for the sticky TOC (`methodology.mjs:6`),
 *  so a jump to e.g. `#where-the-read-is-weak` doesn't land the heading behind the bar. */
const SCROLL_CLEAR = { xs: 72, md: 76 } as const;

const headingId = (section: MethodSection) => `${section.id}-heading`;

function SectionBlocks({ section }: { section: MethodSection }) {
  const vocabulary = section.id === 'vocabulary';
  return (
    <>
      {section.blocks.map((block, blockIndex) => {
        if (block.kind === 'prose') {
          return (
            <Stack key={`${section.id}-prose-${blockIndex}`} spacing={1.25} sx={{ mb: 1.5 }}>
              {block.body.map((para, paraIndex) => (
                <Typography
                  key={`${section.id}-p-${blockIndex}-${paraIndex}`}
                  component="p"
                  variant="body2"
                  sx={{
                    color: block.muted ? 'text.secondary' : 'text.primary',
                    m: 0,
                    lineHeight: 1.65,
                  }}
                >
                  {para}
                </Typography>
              ))}
            </Stack>
          );
        }
        return (
          <Table key={`${section.id}-table-${blockIndex}`} size="small" sx={{ mb: 1.5 }}>
            <TableHead>
              <TableRow>
                {block.head.map((h) => (
                  <TableCell key={h} scope="col">
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {block.rows.map((row, rowIndex) => (
                <TableRow key={`${section.id}-row-${rowIndex}`}>
                  {row.map((cell, cellIndex) => {
                    const isVocabLiteral = vocabulary && cellIndex === 0;
                    return (
                      <TableCell
                        key={`${section.id}-cell-${rowIndex}-${cellIndex}`}
                        data-testid={isVocabLiteral ? 'vocab-literal' : undefined}
                        sx={isVocabLiteral ? { ...SANS_FACE } : undefined}
                      >
                        {cell}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );
      })}
    </>
  );
}

export function MethodologyPage() {
  useEffect(() => {
    const prev = document.title;
    document.title = 'How Convexa works — methodology';
    return () => {
      document.title = prev;
    };
  }, []);

  // GATE Z I-1 (AC-M1) — a FRESH `/methodology#id` load: the browser's own scroll-to-fragment
  // step already ran, before React had rendered this lazy route's sections, so it found nothing.
  // Run the equivalent once after mount, against the real DOM.
  useEffect(() => {
    if (!window.location.hash) return;
    let id: string;
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return;
    }
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ block: 'start' });
    target.focus();
  }, []);

  return (
    <Box
      data-testid="methodology-page"
      sx={{ maxWidth: 1040, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 3, md: 5 } }}
    >
      <Stack spacing={1.5} sx={{ mb: 4, maxWidth: 760 }}>
        <Typography
          component="h1"
          variant="h4"
          sx={{ fontWeight: 700, letterSpacing: '-0.01em', m: 0 }}
        >
          {METHOD_COPY.title}
        </Typography>
        <Typography component="p" variant="body1" sx={{ color: 'text.secondary', m: 0 }}>
          {METHOD_COPY.subhead}
        </Typography>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '220px minmax(0, 760px)' },
          gap: { xs: 2, md: 6 },
        }}
      >
        <Box
          component="nav"
          aria-label="On this page"
          data-testid="methodology-toc"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.25,
            position: { xs: 'static', md: 'sticky' },
            top: { md: SCROLL_CLEAR.md },
            alignSelf: 'start',
          }}
        >
          {METHOD_COPY.sections.map((section) => (
            <Box
              key={section.id}
              component="a"
              href={`/methodology#${section.id}`}
              sx={{
                display: 'flex',
                alignItems: 'center',
                minHeight: 44,
                px: 1.5,
                borderRadius: 1,
                fontSize: '0.8125rem',
                color: 'text.secondary',
                textDecoration: 'none',
                '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
              }}
            >
              {section.h}
            </Box>
          ))}
        </Box>

        <Stack component="article" spacing={4.5} sx={{ minWidth: 0 }}>
          {METHOD_COPY.sections.map((section) => (
            <Box
              key={section.id}
              component="section"
              id={section.id}
              aria-labelledby={headingId(section)}
              tabIndex={-1}
              sx={{ scrollMarginTop: SCROLL_CLEAR }}
            >
              <Typography
                component="h2"
                id={headingId(section)}
                variant="h6"
                sx={{ fontWeight: 700, mb: 1.25, letterSpacing: '-0.01em' }}
              >
                {section.h}
              </Typography>
              <SectionBlocks section={section} />
            </Box>
          ))}
        </Stack>
      </Box>

      <Typography
        component="p"
        variant="caption"
        data-testid="methodology-disclaimer"
        sx={{ display: 'block', color: 'text.secondary', mt: 4, lineHeight: 1.5 }}
      >
        {METHOD_COPY.disclaimer}
      </Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ mt: 3 }}
        data-testid="methodology-ctas"
      >
        <Button
          component={RouterLink}
          to="/scanner"
          variant="contained"
          data-testid="methodology-cta-scanner"
          sx={{ minHeight: 44 }}
        >
          {METHOD_COPY.ctaScanner}
        </Button>
        <Button
          component={RouterLink}
          to="/ticker"
          variant="outlined"
          data-testid="methodology-cta-ticker"
          // GATE Z I-2 (AC-G1, color-contrast, serious): outlined-button labels default to
          // `primary.main` (measured 3.01:1 on `background.default` in light mode) — same
          // text-grade-amber fix as the landing's `cta-secondary` (F7c, `591e2654`).
          sx={{ minHeight: 44, color: (theme) => extrasFor(theme).textAmber }}
        >
          {METHOD_COPY.ctaTicker}
        </Button>
        <Button
          component={RouterLink}
          to="/"
          variant="text"
          data-testid="methodology-cta-home"
          // GATE Z I-2 (AC-G1, color-contrast, serious): same fix as `methodology-cta-ticker`
          // above — a `text` variant button also labels itself with `primary.main` by default.
          sx={{ minHeight: 44, color: (theme) => extrasFor(theme).textAmber }}
        >
          {METHOD_COPY.ctaBack}
        </Button>
      </Stack>
    </Box>
  );
}

export default MethodologyPage;

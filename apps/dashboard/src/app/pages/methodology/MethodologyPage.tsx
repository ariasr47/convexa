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
 * Layout (fidelity COL, SITE-02): the trust pages' document layout (`trust/DocPage.tsx`, the Final
 * board's `.doc` in `design/src/screens/final/shell-site-docs.mjs` `methodologyBoard`) on the page
 * column — a 240px index, a 48px gap, and a 562px reading column (the board's `.doc article`, 72ch)
 * that opens with the H1 in display type at clamp(32px, 3.4vw, 44px), so the index's top lines up
 * with the H1's (y130 at 1440, 32px under the nav). Section headings are 24px display type; body
 * copy is 15.5/1.65 in `text.secondary` (the "muted" limitation notes 14px), 18px apart, with 24px
 * more above each heading. "What's live" sits in bordered panels (`WhatsLive.tsx`). The disclaimer
 * and the three actions close the reading column, as on the board. The title block is its own grid
 * item, so under 900px the index rail still comes under the title.
 *
 * The on-this-page index is a sticky VERTICAL list from `md` (mirrors
 * `design/src/screens/methodology.mjs:6`'s `.toc { position: sticky }`). Under 900px it is the
 * Final board's sideways rail of 44px chips under the title (design/src/screens/v4/docs-dialogs.mjs
 * `.doc nav` at ≤899px; shell-site-docs.mjs “Phone · index rail”): in flow, not sticky, scrolling
 * sideways inside its own box (`overflow-x: auto`, `overscroll-behavior-x: contain`) so the page
 * never scrolls sideways; the grid column is `minmax(0, 1fr)` so the rail can't widen the page.
 * The current chip is filled, and when it changes the rail scrolls itself (`scrollLeft`, never
 * `scrollIntoView`, which would move the page) to keep it in view. The grid row is left at its
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
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { isDemoBuild } from '@/shared/lib/demoSite';
import { extrasFor, typographyTokens } from '@/shared/theme/tokens';
import { pageColumnSx } from '@/shared/ui/PageColumn';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import type { Theme } from '@mui/material/styles';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { METHOD_COPY, WHATS_LIVE, type MethodSection } from './copy';
import { DOC_BODY, WhatsLiveBody } from './WhatsLive';

/** The on-this-page index: “What’s live on this site” first (the bar's deep link), then the
 *  copy's sections. One list, so the index and the body cannot diverge. */
const INDEX: readonly { id: string; h: string }[] = [
  { id: WHATS_LIVE.id, h: WHATS_LIVE.h },
  ...METHOD_COPY.sections.map((s) => ({ id: s.id, h: s.h })),
];

/** Deep-link scroll clearance under the sticky `TopNav` (`{xs:56,md:60}` tall) plus breathing
 *  room — mirrors the design source's own `top: 76px` for the sticky TOC (`methodology.mjs:6`),
 *  so a jump to e.g. `#where-the-read-is-weak` doesn't land the heading behind the bar. */
const SCROLL_CLEAR = { xs: 72, md: 76 } as const;

const headingId = (section: MethodSection) => `${section.id}-heading`;

/** Display type, the boards' `.display` (as the trust pages set it, `trust/DocPage.tsx`). */
const DOC_DISPLAY = {
  fontFamily: typographyTokens.displayFontFamily,
  fontStretch: typographyTokens.displayFontStretch,
  fontWeight: 700,
  lineHeight: 1.1,
} as const;

/** The board's `.doc article` rhythm: 18px between blocks, 24px more above each section heading. */
const ARTICLE_GAP = 2.25;

/** A section heading: 24px display type, as on the trust pages (`DocPage.tsx` `H2`). */
const H2_SX = {
  ...DOC_DISPLAY,
  fontSize: 24,
  letterSpacing: '-0.01em',
  m: 0,
  mt: 3,
  textWrap: 'balance',
} as const;

/** A section's table, the board's `.ss-tbl`: 13.5px, caps steel headers over the strong line, steel
 *  cells top-aligned on hairlines with no lead-in padding, the first column in `text.primary`. */
const SECTION_TABLE_SX = (t: Theme) =>
  ({
    '& th': {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      lineHeight: 1.5,
      color: 'text.secondary',
      p: '8px 10px 8px 0',
      borderBottom: `1px solid ${extrasFor(t).lineStrong}`,
    },
    '& td': {
      fontSize: 13.5,
      lineHeight: 1.5,
      color: 'text.secondary',
      verticalAlign: 'top',
      p: '9px 10px 9px 0',
      borderBottom: `1px solid ${t.palette.divider}`,
    },
    '& td:first-of-type': { color: 'text.primary' },
  }) as const;

/** A section: its blocks 18px apart, the heading first. */
const SECTION_SX = {
  display: 'flex',
  flexDirection: 'column',
  gap: ARTICLE_GAP,
  scrollMarginTop: SCROLL_CLEAR,
  '&:focus:not(:focus-visible)': { outline: 'none' },
} as const;

function SectionBlocks({ section }: { section: MethodSection }) {
  const vocabulary = section.id === 'vocabulary';
  return (
    <>
      {section.blocks.map((block, blockIndex) => {
        if (block.kind === 'prose') {
          return (
            <Stack key={`${section.id}-prose-${blockIndex}`} spacing={ARTICLE_GAP}>
              {block.body.map((para, paraIndex) => (
                <Typography
                  key={`${section.id}-p-${blockIndex}-${paraIndex}`}
                  component="p"
                  sx={[DOC_BODY, block.muted ? { fontSize: 14 } : {}]}
                >
                  {para}
                </Typography>
              ))}
            </Stack>
          );
        }
        return (
          <Table key={`${section.id}-table-${blockIndex}`} size="small" sx={SECTION_TABLE_SX}>
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
  // Ends in ' — Convexa' like every page's title (useDocumentTitle.ts); "Methodology" is the name
  // the site and the boards give this page (site audit 2026-10-25, SEO-3).
  useDocumentTitle('Methodology — Convexa');

  // GATE Z I-1 (AC-M1) — a FRESH `/methodology#id` load: the browser's own scroll-to-fragment
  // step already ran, before React had rendered this lazy route's sections, so it found nothing.
  // Run the equivalent after mount, against the real DOM — and again whenever the hash changes
  // inside the app (the bar's “What’s live” is a router link, which never scrolls by itself).
  const { hash } = useLocation();
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    if (!hash) return;
    let id: string;
    try {
      id = decodeURIComponent(hash.slice(1));
    } catch {
      return;
    }
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView?.({ block: 'start' });
    target.focus();
    setCurrent(id);
  }, [hash]);

  // The index marks the section being read: the first one in view under the nav.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        const first = INDEX.find((entry) => visible.has(entry.id));
        if (first) setCurrent(first.id);
      },
      { rootMargin: '-80px 0px -55% 0px' },
    );
    for (const entry of INDEX) {
      const el = document.getElementById(entry.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  // Keep the current chip in view inside the phone rail. Only the rail scrolls: on a wide screen
  // the index is a vertical list that doesn't overflow sideways, so this is a no-op there.
  // Until a section scrolls into the reading band (on a phone the title fills it), the first entry
  // is current, as the board draws it.
  const shownCurrent = current ?? INDEX[0].id;
  const railRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || rail.scrollWidth <= rail.clientWidth) return;
    const chip = rail.querySelector<HTMLElement>('[aria-current="true"]');
    if (!chip) return;
    const left = chip.offsetLeft - rail.offsetLeft;
    const right = left + chip.offsetWidth;
    if (left < rail.scrollLeft || right > rail.scrollLeft + rail.clientWidth) {
      rail.scrollLeft = Math.max(0, left - 16);
    }
  }, [shownCurrent]);

  const demo = isDemoBuild();

  return (
    <Box
      data-testid="methodology-page"
      sx={{ ...pageColumnSx, pt: { xs: 3, md: 4 }, pb: { xs: 3, md: 5 } }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '240px minmax(0, 1fr)' },
          // From 900px: the title block and the article share column 2, the index spans both rows.
          gridTemplateRows: { md: 'auto 1fr' },
          columnGap: 6,
          rowGap: { xs: 2, md: ARTICLE_GAP },
        }}
      >
        <Stack
          spacing={1.25}
          sx={{ minWidth: 0, maxWidth: 562, gridColumn: { md: '2' }, gridRow: { md: '1' } }}
        >
          <Typography
            component="h1"
            sx={{
              ...DOC_DISPLAY,
              fontSize: 'clamp(32px, 3.4vw, 44px)',
              letterSpacing: '-0.02em',
              m: 0,
              textWrap: 'balance',
            }}
          >
            {METHOD_COPY.title}
          </Typography>
          <Typography component="p" sx={DOC_BODY}>
            {METHOD_COPY.subhead}
          </Typography>
        </Stack>

        <Box
          component="nav"
          ref={railRef}
          aria-label="On this page"
          data-testid="methodology-toc"
          sx={{
            display: 'flex',
            flexDirection: { xs: 'row', md: 'column' },
            gap: { xs: 0.75, md: 0.25 },
            minWidth: 0,
            overflowX: { xs: 'auto', md: 'visible' },
            overscrollBehaviorX: 'contain',
            scrollbarWidth: 'thin',
            position: { xs: 'static', md: 'sticky' },
            top: { md: SCROLL_CLEAR.md },
            alignSelf: 'start',
            gridColumn: { md: '1' },
            gridRow: { md: '1 / span 2' },
          }}
        >
          {INDEX.map((section) => (
            <Box
              key={section.id}
              component="a"
              href={`/methodology#${section.id}`}
              aria-current={shownCurrent === section.id ? 'true' : undefined}
              sx={{
                display: 'flex',
                alignItems: 'center',
                flex: { xs: '0 0 auto', md: 'initial' },
                whiteSpace: { xs: 'nowrap', md: 'normal' },
                minHeight: 44,
                px: 1.5,
                borderRadius: 1,
                fontSize: '0.8125rem',
                color: 'text.secondary',
                textDecoration: 'none',
                '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
                // The theme's one focus ring, drawn inset so the rail's overflow box never clips it.
                '&:focus-visible': { outlineOffset: '-2px' },
                '&[aria-current="true"]': {
                  color: 'text.primary',
                  bgcolor: 'action.selected',
                  fontWeight: 600,
                },
              }}
            >
              {section.h}
            </Box>
          ))}
        </Box>

        <Stack
          component="article"
          spacing={ARTICLE_GAP}
          sx={{ minWidth: 0, maxWidth: 562, gridColumn: { md: '2' }, gridRow: { md: '2' } }}
        >
          <Box
            component="section"
            id={WHATS_LIVE.id}
            aria-labelledby={`${WHATS_LIVE.id}-heading`}
            tabIndex={-1}
            data-testid="methodology-whats-live"
            data-form={demo ? 'staging' : 'production'}
            sx={SECTION_SX}
          >
            <Typography component="h2" id={`${WHATS_LIVE.id}-heading`} sx={H2_SX}>
              {WHATS_LIVE.h}
            </Typography>
            <WhatsLiveBody demo={demo} />
          </Box>
          {METHOD_COPY.sections.map((section) => (
            <Box
              key={section.id}
              component="section"
              id={section.id}
              aria-labelledby={headingId(section)}
              tabIndex={-1}
              sx={SECTION_SX}
            >
              <Typography component="h2" id={headingId(section)} sx={H2_SX}>
                {section.h}
              </Typography>
              <SectionBlocks section={section} />
            </Box>
          ))}

          <Typography
            component="p"
            data-testid="methodology-disclaimer"
            sx={{
              m: 0,
              pt: 2,
              borderTop: 1,
              borderColor: 'divider',
              fontSize: 13,
              lineHeight: 1.65,
              color: 'text.secondary',
              textWrap: 'pretty',
            }}
          >
            {METHOD_COPY.disclaimer}
          </Typography>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            useFlexGap
            sx={{ flexWrap: 'wrap' }}
            data-testid="methodology-ctas"
          >
            {/* D-15 / ruling A (2026-10-15): the free Ticker is the one amber primary, as the board
                draws it; production walls the Scanner behind sign-in, so it is the neutral second.
                Back to home is a neutral text button. */}
            <Button
              component={RouterLink}
              to="/ticker"
              variant="contained"
              data-testid="methodology-cta-ticker"
              sx={{ minHeight: 44 }}
            >
              {METHOD_COPY.ctaTicker}
            </Button>
            <Button
              component={RouterLink}
              to="/scanner"
              variant="outlined"
              color="inherit"
              data-testid="methodology-cta-scanner"
              sx={{ minHeight: 44, borderColor: 'divider' }}
            >
              {METHOD_COPY.ctaScanner}
            </Button>
            <Button
              component={RouterLink}
              to="/"
              variant="text"
              color="inherit"
              data-testid="methodology-cta-home"
              sx={{ minHeight: 44 }}
            >
              {METHOD_COPY.ctaBack}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}

export default MethodologyPage;

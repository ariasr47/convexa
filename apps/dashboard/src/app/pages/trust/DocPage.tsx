/**
 * The document layout the three trust pages share (Sources and credits, Privacy, Terms): an
 * on-this-page index beside a reading column, as on Methodology. On a phone the index becomes a
 * sideways row of 44px chips under the nav.
 *
 * Index links are absolute-path fragments (`/privacy#short`): index.html declares `<base href="/">`,
 * so a bare `#short` would resolve to the landing (MethodologyPage.tsx docblock, GATE Z I-1). A fresh
 * load of `/privacy#id` scrolls once after mount, because the browser's own attempt ran before this
 * lazy route rendered.
 *
 * Design: design/src/screens/final/trust-pages.mjs (docPage, TR_CSS).
 */
import { extrasFor } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useEffect, type ReactNode } from 'react';

const SCROLL_CLEAR = { xs: 72, md: 80 } as const;

export const linkSx = { color: (t: Theme) => extrasFor(t).textInfo } as const;

export function DocPage({
  path,
  eyebrow,
  title,
  docTitle,
  updated,
  lead,
  toc,
  children,
  testId,
}: {
  path: string;
  eyebrow: string;
  title: string;
  docTitle: string;
  /** "Last updated Oct 14, 2026", or nothing. */
  updated?: string;
  lead?: ReactNode;
  toc: ReadonlyArray<readonly [id: string, label: string]>;
  children: ReactNode;
  testId: string;
}) {
  useEffect(() => {
    const prev = document.title;
    document.title = docTitle;
    return () => {
      document.title = prev;
    };
  }, [docTitle]);

  useEffect(() => {
    if (!window.location.hash) return;
    let id: string;
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return;
    }
    document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, []);

  return (
    <Box
      data-testid={testId}
      sx={{ maxWidth: 1120, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 3, md: 5 } }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '200px minmax(0, 1fr)' },
          gap: { xs: 2.5, md: 6 },
        }}
      >
        <Box
          component="nav"
          aria-label="On this page"
          sx={{
            display: 'flex',
            flexDirection: { xs: 'row', md: 'column' },
            gap: { xs: 1, md: 0.25 },
            overflowX: { xs: 'auto', md: 'visible' },
            position: { xs: 'static', md: 'sticky' },
            top: { md: SCROLL_CLEAR.md },
            alignSelf: 'start',
            order: { xs: 0, md: 0 },
            mx: { xs: -2, md: 0 },
            px: { xs: 2, md: 0 },
            pb: { xs: 0.5, md: 0 },
          }}
        >
          {toc.map(([id, label]) => (
            <Box
              key={id}
              component="a"
              href={`${path}#${id}`}
              sx={{
                display: 'flex',
                alignItems: 'center',
                flex: 'none',
                minHeight: 44,
                px: 1.5,
                borderRadius: { xs: '22px', md: 1 },
                border: { xs: 1, md: 0 },
                borderColor: 'divider',
                fontSize: '0.8125rem',
                color: 'text.secondary',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
              }}
            >
              {label}
            </Box>
          ))}
        </Box>

        <Box
          component="article"
          sx={{ minWidth: 0, maxWidth: '78ch', display: 'flex', flexDirection: 'column', gap: 3 }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Typography
              component="span"
              sx={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'text.secondary',
              }}
            >
              {eyebrow}
            </Typography>
            <Typography
              component="h1"
              variant="h4"
              sx={{ fontWeight: 700, letterSpacing: '-0.01em', m: 0, textWrap: 'balance' }}
            >
              {title}
            </Typography>
            {updated && (
              <Typography
                component="span"
                sx={{
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: 12,
                  color: 'text.secondary',
                }}
              >
                {updated}
              </Typography>
            )}
            {lead}
          </Box>
          {children}
        </Box>
      </Box>
    </Box>
  );
}

/** A section heading: its id is the deep-link anchor, clear of the sticky nav. */
export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <Typography
      component="h2"
      id={id}
      variant="h6"
      sx={{
        fontWeight: 700,
        letterSpacing: '-0.01em',
        m: 0,
        mt: 1.5,
        scrollMarginTop: SCROLL_CLEAR,
        textWrap: 'balance',
      }}
    >
      {children}
    </Typography>
  );
}

export function Para({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Typography
      component="p"
      variant="body2"
      sx={[
        {
          m: 0,
          lineHeight: 1.65,
          color: 'text.secondary',
          fontSize: 15,
          textWrap: 'pretty',
          '& strong': { color: 'text.primary', fontWeight: 600 },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Typography>
  );
}

export function Lead({ children }: { children: ReactNode }) {
  return (
    <Typography
      component="p"
      sx={{
        m: 0,
        fontSize: { xs: 16, md: 17 },
        lineHeight: 1.6,
        color: 'text.primary',
        textWrap: 'pretty',
      }}
    >
      {children}
    </Typography>
  );
}

/** A plain bordered box; `demo` draws it dashed (sample data). */
export function DocBox({ children, demo = false }: { children: ReactNode; demo?: boolean }) {
  return (
    <Box
      sx={{
        border: 1,
        borderStyle: demo ? 'dashed' : 'solid',
        borderColor: demo ? 'text.secondary' : 'divider',
        borderRadius: '12px',
        bgcolor: 'background.paper',
        p: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      {children}
    </Box>
  );
}

/** A table that scrolls inside its own box; on a phone each row stacks. */
export function DocTable({
  head,
  rows,
  monoFirst = false,
}: {
  head: string[];
  rows: ReactNode[][];
  monoFirst?: boolean;
}) {
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box
        component="table"
        sx={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13.5,
          '& th': {
            textAlign: 'left',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'text.secondary',
            borderBottom: 1,
            borderColor: 'divider',
            py: 1,
            pr: 2,
          },
          '& td': {
            verticalAlign: 'top',
            borderBottom: 1,
            borderColor: 'divider',
            py: 1.25,
            pr: 2,
            lineHeight: 1.55,
            color: 'text.primary',
          },
          ...(monoFirst && {
            '& td:first-of-type': {
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: 12.5,
              whiteSpace: { xs: 'normal', sm: 'nowrap' },
              overflowWrap: 'anywhere',
            },
          }),
          '@media (max-width: 599px)': {
            '& thead': { display: 'none' },
            '& tr': { display: 'block', py: 1.25, borderBottom: 1, borderColor: 'divider' },
            '& td': { display: 'block', border: 0, py: 0.25, pr: 0 },
          },
        }}
      >
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </Box>
    </Box>
  );
}

/** FINRA's notice, as its terms for free equity data (§2.3) require wherever its figures appear. */
export function FinraNotice() {
  return (
    <Box
      component="p"
      data-testid="finra-notice"
      sx={(t) => ({
        m: 0,
        fontSize: 13.5,
        lineHeight: 1.55,
        color: 'text.primary',
        borderLeft: `2px solid ${t.palette.text.secondary}`,
        bgcolor: extrasFor(t).well,
        p: '10px 14px',
        borderRadius: '0 8px 8px 0',
        textWrap: 'pretty',
      })}
    >
      <strong>Data owned and provided by FINRA.</strong> FINRA owns and is the source of the
      short-interest and short-sale-volume data on this site, including the percentages and averages
      Convexa calculates from it. Shown free for non-commercial personal use; please don&apos;t
      redistribute it.
    </Box>
  );
}

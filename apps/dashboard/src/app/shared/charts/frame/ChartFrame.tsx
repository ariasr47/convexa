/**
 * The one chart frame (canon P-8 to P-13, owner rulings 2026-10-14). Every chart on the site sits in
 * it, so every chart says the same things in the same places:
 *
 * - The border is the provenance (P-8): solid for Convexa's own figures or a primary source, dotted
 *   for a third party's, dashed with a hatch stripe for sample data.
 * - The title states the finding only when the chart has data; every other state names the metric
 *   (P-10, frameTitle.ts). The subtitle holds the metric, the unit and the period.
 * - A state tag sits beside the title (Updated Oct 13, Computed, Demo · sample data…).
 * - The foot carries the source chip, in the frame's provenance, and the as-of line.
 * - "Show the numbers" opens the table twin: the same values as text, for every chart.
 * - In loading and message states the body keeps the chart's final height (no layout shift); a
 *   message sits on a faint ghost grid, a failure marked in the warning colour, never green or red.
 *
 * Text inside a chart is HTML or SVG text at 11px or more (P-13); that's the plot's job, not the frame's.
 *
 * Design: design/src/chart-kit.mjs (chartFrame, dataTable, stateBody), screens/v5/system.mjs.
 */
import { creditsAnchor } from '@/shared/credits/anchor';
import { CreditsLink } from '@/shared/credits/CreditsLink';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import type { DataStateKey } from '@/shared/dataState/vocabulary';
import { extrasFor } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import { alpha } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { frameTitle, type ChartStatus } from './frameTitle';

export type Provenance = 'primary' | 'third' | 'sample';

export interface TableTwinData {
  caption: string;
  cols: string[];
  /** The first cell of each row is its header (a date, a maturity); the rest are figures. */
  rows: (string | number)[][];
}

const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const BORDER: Record<Provenance, 'solid' | 'dotted' | 'dashed'> = {
  primary: 'solid',
  third: 'dotted',
  sample: 'dashed',
};

export function ChartFrame({
  finding,
  metric,
  sub,
  provenance,
  status = { kind: 'ready' },
  tag,
  height,
  legend,
  note,
  source,
  asOf,
  table,
  action,
  headingLevel = 'h3',
  children,
  testId,
}: {
  /** The title over ready data: a finding, not a label. */
  finding: string;
  /** The title in every other state: what the chart measures. */
  metric: string;
  sub?: ReactNode;
  provenance: Provenance;
  status?: ChartStatus;
  tag?: { state: DataStateKey; detail?: string };
  /** The plot's height, kept by the loading and message bodies. */
  height: number;
  legend?: ReactNode;
  note?: ReactNode;
  source?: { text: string; href?: string };
  asOf?: string;
  table?: TableTwinData;
  /** A message state's one action (Try again). */
  action?: ReactNode;
  headingLevel?: 'h2' | 'h3';
  children?: ReactNode;
  testId?: string;
}) {
  const title = frameTitle(status, finding, metric);
  const ready = status.kind === 'ready';
  return (
    <Box
      component="figure"
      data-testid={testId}
      data-provenance={provenance}
      sx={(t) => ({
        position: 'relative',
        m: 0,
        p: { xs: '14px 14px 12px', sm: '18px 20px 14px' },
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        minWidth: 0,
        height: '100%',
        bgcolor: 'background.paper',
        borderRadius: '12px',
        border: `1px ${BORDER[provenance]} ${
          provenance === 'primary' ? t.palette.divider : extrasFor(t).textTertiary
        }`,
        ...(provenance === 'sample' && {
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 8,
            borderRadius: '11px 11px 0 0',
            pointerEvents: 'none',
            background: `repeating-linear-gradient(135deg, transparent 0 6px, ${alpha(
              t.palette.text.secondary,
              0.28,
            )} 6px 12px)`,
          },
        }),
      })}
    >
      <Box
        component="figcaption"
        sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '6px 10px' }}>
          <Box
            component={headingLevel}
            sx={{
              m: 0,
              flex: '1 1 260px',
              minWidth: 0,
              fontSize: { xs: 14, sm: 15 },
              fontWeight: 600,
              lineHeight: 1.35,
              color: 'text.primary',
              textWrap: 'balance',
            }}
          >
            {title}
          </Box>
          {tag && <DataStateTag state={tag.state} detail={tag.detail} />}
        </Box>
        {sub && (
          <Box
            component="p"
            sx={{
              m: 0,
              fontSize: 12,
              lineHeight: 1.45,
              color: 'text.secondary',
              textWrap: 'pretty',
            }}
          >
            {sub}
          </Box>
        )}
      </Box>

      {ready && legend}
      {ready ? (
        children
      ) : (
        <StateBody status={status} height={height} metric={metric} action={action} />
      )}
      {ready && note && (
        <Box
          component="p"
          sx={{ m: 0, fontSize: 12, lineHeight: 1.45, color: 'text.secondary', textWrap: 'pretty' }}
        >
          {note}
        </Box>
      )}

      {(source || asOf) && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '6px 12px',
            mt: 'auto',
            fontSize: 12,
            color: 'text.secondary',
          }}
        >
          {source && <SourceChip text={source.text} href={source.href} provenance={provenance} />}
          {asOf && (
            <Box component="span" sx={{ fontFamily: MONO, fontSize: 11, lineHeight: 1.3 }}>
              {asOf}
            </Box>
          )}
        </Box>
      )}
      {ready && table && <TableTwin {...table} />}
    </Box>
  );
}

function StateBody({
  status,
  height,
  metric,
  action,
}: {
  status: Exclude<ChartStatus, { kind: 'ready' }>;
  height: number;
  metric: string;
  action?: ReactNode;
}) {
  if (status.kind === 'loading') {
    return (
      <Box role="img" aria-label={`Loading ${metric}`} aria-busy="true" sx={{ height }}>
        <Skeleton variant="rounded" height={height} sx={{ borderRadius: '6px' }} />
      </Box>
    );
  }
  const warn = status.tone === 'warn';
  return (
    <Box
      sx={(t) => ({
        position: 'relative',
        // At least the plot's height, so the frame doesn't shift; taller when the message needs it.
        minHeight: height,
        display: 'flex',
        alignItems: 'center',
        p: 1,
        // The ghost grid: the chart's outline, so the frame reads as a chart with nothing in it.
        backgroundImage: `repeating-linear-gradient(0deg, transparent 0 calc(25% - 1px), ${alpha(
          t.palette.text.secondary,
          0.14,
        )} calc(25% - 1px) 25%)`,
      })}
    >
      <Box
        role={warn ? 'alert' : 'status'}
        sx={(t) => ({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 1,
          maxWidth: 480,
          p: '12px 14px',
          borderRadius: '10px',
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          ...(warn && { borderLeft: `2px solid ${t.palette.warning.main}` }),
        })}
      >
        <Box component="p" sx={{ m: 0, fontSize: 13, lineHeight: 1.5, textWrap: 'pretty' }}>
          {status.text}
        </Box>
        {status.cause && (
          <Box
            component="p"
            sx={{ m: 0, fontSize: 12, color: 'text.secondary', textWrap: 'pretty' }}
          >
            {status.cause}
          </Box>
        )}
        {action}
      </Box>
    </Box>
  );
}

/** Where the figures come from, in the frame's provenance: solid, dotted (third party), dashed (sample). */
function SourceChip({
  text,
  href,
  provenance,
}: {
  text: string;
  href?: string;
  provenance: Provenance;
}) {
  const chip = (
    <Box
      component="span"
      sx={(t) => ({
        display: 'inline-block',
        maxWidth: '100%',
        minHeight: 24,
        px: 1.25,
        py: '4px',
        fontFamily: MONO,
        fontSize: 11,
        lineHeight: 1.35,
        borderRadius: '12px',
        border: `1px ${BORDER[provenance]} ${alpha(
          t.palette.text.secondary,
          provenance === 'primary' ? 0.3 : 0.55,
        )}`,
        color: provenance === 'sample' ? 'text.secondary' : 'text.primary',
        overflowWrap: 'anywhere',
      })}
    >
      {text}
    </Box>
  );
  // A chip that names a source links to its card on /credits, which links on to the source. A
  // TradingView link stays as given: it is TradingView's attribution (its policies §4).
  const attribution = href !== undefined && /(^|\.)tradingview\.com\//.test(href);
  if (!attribution && creditsAnchor(text)) return <CreditsLink text={text}>{chip}</CreditsLink>;
  return href ? (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      underline="none"
      sx={{ maxWidth: '100%' }}
    >
      {chip}
    </Link>
  ) : (
    chip
  );
}

/** "Show the numbers": the chart's values as a table, for every chart (P-8 to P-13, design table twin). */
export function TableTwin({ caption, cols, rows }: TableTwinData) {
  return (
    <Box component="details" sx={{ '& > summary::-webkit-details-marker': { display: 'none' } }}>
      <Box
        component="summary"
        sx={(t) => ({
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          minHeight: 24,
          cursor: 'pointer',
          listStyle: 'none',
          fontSize: 12,
          fontWeight: 600,
          color: extrasFor(t).textInfo,
          '&::before': { content: '"▸"', fontSize: 11, color: t.palette.text.secondary },
          'details[open] > &::before': { content: '"▾"' },
        })}
      >
        Show the numbers
      </Box>
      <Box
        role="region"
        aria-label={caption}
        tabIndex={0}
        sx={(t) => ({
          mt: 1,
          maxWidth: '100%',
          overflowX: 'auto',
          border: 1,
          borderColor: 'divider',
          borderRadius: '8px',
          '&:focus-visible': { outline: `2px solid ${extrasFor(t).textAmber}`, outlineOffset: 2 },
        })}
      >
        <Box
          component="table"
          sx={(t) => ({
            borderCollapse: 'collapse',
            width: '100%',
            fontSize: 12,
            '& caption': { textAlign: 'left', p: '8px 10px', color: 'text.secondary' },
            '& th, & td': {
              p: '6px 10px',
              textAlign: 'right',
              borderTop: 1,
              borderColor: 'divider',
              whiteSpace: 'nowrap',
            },
            '& th:first-of-type, & td:first-of-type': { textAlign: 'left' },
            '& thead th': { fontWeight: 600, color: 'text.secondary', bgcolor: extrasFor(t).well },
            '& td': { fontFamily: MONO, fontVariantNumeric: 'tabular-nums' },
            '& tbody th': { fontWeight: 500, color: 'text.primary' },
          })}
        >
          <caption>{caption}</caption>
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) =>
                  j === 0 ? (
                    <th key={j} scope="row">
                      {c}
                    </th>
                  ) : (
                    <td key={j}>{c}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </Box>
      </Box>
    </Box>
  );
}

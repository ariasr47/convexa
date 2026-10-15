/**
 * Shared pieces of the public-data views (Markets, Filings, a note's positioning): the provenance chip,
 * the read strip of figure cells, a chart's claim-and-subtitle title, and the states a source can be
 * in. Colours come from the theme; a warning is burnt orange with its icon, never amber alone.
 */
import { CreditsLink } from '@/shared/credits/CreditsLink';
import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { DISPLAY, MONO, PANEL_SX } from './ui';

const CAPS = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'text.secondary',
} as const;

export function Caps({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Box component="span" sx={[CAPS, ...(Array.isArray(sx) ? sx : [sx])]}>
      {children}
    </Box>
  );
}

/** Where a page's data came from. Primary is a public record or an official dataset; sample is the
 *  demo's authored data, dashed. */
/** Solid: a primary source. Dotted: a third party's (TradingView). Dashed: the demo's sample data. */
export function ProvenanceChip({
  text,
  kind,
  link = true,
}: {
  text: string;
  kind: 'primary' | 'third-party' | 'sample';
  /** False inside another control (a choice button): a link nested in a button is invalid, and a
   *  click on it would leave the page and lose what the reader was filling in. */
  link?: boolean;
}) {
  if (!link) return <ChipBody text={text} kind={kind} />;
  // A chip that names a source links to its card on /credits (one place for every chip).
  return (
    <CreditsLink text={text}>
      <ChipBody text={text} kind={kind} />
    </CreditsLink>
  );
}

function ChipBody({ text, kind }: { text: string; kind: 'primary' | 'third-party' | 'sample' }) {
  return (
    <Box
      component="span"
      sx={(t) => ({
        ...MONO,
        // Wraps rather than truncates: on a phone a long source label takes two lines, and a
        // provenance label cut off with an ellipsis would hide the part that names the source.
        display: 'inline-block',
        maxWidth: '100%',
        minHeight: 24,
        px: 1.25,
        py: '4px',
        lineHeight: 1.35,
        borderRadius: '12px',
        border: `1px ${kind === 'sample' ? 'dashed' : kind === 'third-party' ? 'dotted' : 'solid'} ${alpha(t.palette.text.secondary, kind === 'primary' ? 0.3 : 0.55)}`,
        fontSize: 11,
        color: kind === 'sample' ? 'text.secondary' : 'text.primary',
        overflowWrap: 'anywhere',
      })}
    >
      {text}
    </Box>
  );
}

export type ReadCell = { label: string; value: string; sub: string };

/** One row of figure cells, each with a comparison under it: a figure alone means nothing. */
export function ReadStrip({ label, cells }: { label: string; cells: ReadCell[] }) {
  return (
    <Box
      component="section"
      aria-label={label}
      sx={(t) => ({
        ...PANEL_SX,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(190px, 100%), 1fr))',
        gap: '1px',
        bgcolor: t.palette.divider,
      })}
    >
      {cells.map((c) => (
        <Box
          key={c.label}
          sx={{
            bgcolor: 'background.paper',
            p: '16px 20px',
            display: 'grid',
            gap: 0.5,
            alignContent: 'start',
            minWidth: 0,
          }}
        >
          <Caps>{c.label}</Caps>
          <Box
            component="span"
            sx={{ ...MONO, fontSize: { xs: 22, sm: 26 }, fontWeight: 500, lineHeight: 1.2 }}
          >
            {c.value}
          </Box>
          <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
            {c.sub}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/** A chart's title states its finding; the subtitle holds the metric, the unit and the period. */
export function ChartTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <Box component="figcaption" sx={{ display: 'grid', gap: 0.5 }}>
      <Box
        component="span"
        sx={{ ...DISPLAY, fontWeight: 600, fontSize: 20, lineHeight: 1.25, textWrap: 'balance' }}
      >
        {title}
      </Box>
      <Box component="span" sx={{ fontSize: 13, color: 'text.secondary', textWrap: 'pretty' }}>
        {sub}
      </Box>
    </Box>
  );
}

function WarnIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 4l9 16H3zM12 10v4M12 17.5v.01" />
    </svg>
  );
}

/** A source that can't be shown: what is missing, why, and what still works. */
export function SourceProblem({
  title,
  body,
  onRetry,
}: {
  title: string;
  body: string;
  onRetry?: () => void;
}) {
  return (
    <Box
      component="section"
      role="status"
      sx={(t) => ({
        ...PANEL_SX,
        p: { xs: 2, sm: 3 },
        display: 'grid',
        gap: 1,
        // Solid: canon P-3 reserves dashed frames for sample data.
        border: `1px solid ${alpha(t.palette.text.secondary, 0.25)}`,
      })}
    >
      <Box component="span" sx={{ fontWeight: 600 }}>
        {title}
      </Box>
      <Box
        component="span"
        sx={{ fontSize: 14, color: 'text.secondary', maxWidth: '68ch', textWrap: 'pretty' }}
      >
        {body}
      </Box>
      {onRetry && (
        <Box
          component="button"
          type="button"
          onClick={onRetry}
          sx={(t) => ({
            justifySelf: 'start',
            mt: 0.5,
            minHeight: 36,
            px: 1.75,
            borderRadius: '8px',
            border: `1px solid ${alpha(t.palette.text.secondary, 0.3)}`,
            bgcolor: 'transparent',
            color: 'text.primary',
            font: 'inherit',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            '&:active': { transform: 'scale(0.98)' },
            '@media (pointer: coarse)': { minHeight: 44 },
          })}
        >
          Try again
        </Box>
      )}
    </Box>
  );
}

/** A source answered late or not at all and an earlier copy is showing. */
export function StaleNote({ text }: { text: string }) {
  return (
    <Box
      role="status"
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        fontSize: 13,
        color: 'warning.main',
      }}
    >
      <Box component="span" sx={{ mt: '2px', display: 'inline-flex' }}>
        <WarnIcon />
      </Box>
      <Box component="span" sx={{ color: 'text.primary' }}>
        {text}
      </Box>
    </Box>
  );
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return (
    <Box component="p" sx={{ m: 0, fontSize: 12, color: 'text.secondary', maxWidth: '90ch' }}>
      {children}
    </Box>
  );
}

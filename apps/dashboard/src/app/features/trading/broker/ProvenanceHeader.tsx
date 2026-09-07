/**
 * ProvenanceHeader — the surface's SIGNATURE element: the mono `as of` ledger stamp, under the
 * steel-outline `Webull · read-only` chip and the on-demand honesty line (SPEC §4 design
 * direction). It is the one place the Broker tab claims anything about freshness, and the claim
 * is always a stamped snapshot — never a stream.
 *
 * Design rails honored: neutral steel-outline chip (not amber — brand-structural; not green/red —
 * P/L direction only), stamp + age in the mono data face with `tabular-nums`, no pulsing dot, no
 * `LIVE` badge, no padlock. The stale (S6) clause FOREGROUNDS the age; staleness never blanks or
 * re-dresses the snapshot fields (their treatment lives on the rows).
 */
import { MONO_FACE } from '@/shared/figure';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { BROKER_COPY, ageText, stampTime } from './copy';

interface Props {
  /** ISO as_of of the served snapshot (present on every S3–S8-with-snapshot render). */
  asOf: string;
  /** S6 — the book-snapshot axis modifier. */
  isStale: boolean;
  /** Whole seconds of snapshot age (for the stale clause). */
  ageSeconds: number | null;
  onRefresh: () => void;
  refreshing: boolean;
}

export function ProvenanceHeader({ asOf, isStale, ageSeconds, onRefresh, refreshing }: Props) {
  const time = stampTime(asOf);
  return (
    <Box
      data-testid="broker-provenance-header"
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px',
        mt: '16px',
        mb: '12px',
      }}
    >
      {/* Steel-outline read-only chip — brand-structural neutrality, ≥11px label. */}
      <Box
        component="span"
        data-testid="broker-readonly-chip"
        sx={{
          fontSize: '0.6875rem',
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'text.secondary',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '4px',
          padding: '2px 8px',
          whiteSpace: 'nowrap',
        }}
      >
        {BROKER_COPY.header.chip}
      </Box>

      {/* The ledger stamp — mono, tabular-nums; tooltip carries the honesty mechanism. */}
      <Tooltip title={BROKER_COPY.header.stampTip} placement="bottom-start">
        <Typography
          component="span"
          data-testid="broker-as-of-stamp"
          sx={{
            ...MONO_FACE,
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: isStale ? 'text.primary' : 'text.secondary',
            cursor: 'default',
          }}
        >
          {isStale && ageSeconds != null
            ? BROKER_COPY.s6(time, ageText(ageSeconds))
            : BROKER_COPY.header.asOf(time)}
        </Typography>
      </Tooltip>

      <Typography
        component="span"
        sx={{ fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'nowrap' }}
      >
        {BROKER_COPY.header.onDemand}
      </Typography>

      <Box sx={{ flexGrow: 1 }} />

      {/* Force-fetch refresh (C4) — outcome honesty is the panel's note, never a silent no-op. */}
      <Button
        size="small"
        variant="outlined"
        data-testid="broker-refresh"
        onClick={onRefresh}
        disabled={refreshing}
        sx={{ minHeight: 44, px: '14px' }}
      >
        {BROKER_COPY.refresh.action}
      </Button>
    </Box>
  );
}

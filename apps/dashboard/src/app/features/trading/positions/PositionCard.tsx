/**
 * PositionCard (convexa-redesign · Positions — Figma PositionCard `108:58`). EXTRACTED verbatim from the
 * card branch that previously lived inside `PositionsView.tsx` — same markup, same `data-testid`s, same
 * logic. A single position rendered as a card:
 *   - Top: ticker (bold mono) + `$strike Call/Put` leg (left) · outlined strategy chip (right).
 *   - Mid (the LIVE block, dims on an SSE drop): large mono P/L (colored by direction) + P/L% beneath
 *     (left) · the `PlSparkline` trend (right).
 *   - Footer: Qty · Entry · Mark (muted label + bold-mono value) · expiry. The Mark value + the live
 *     block dim together offline (`liveDim`); the static facts (Qty/Entry/expiry/ticker/leg) persist.
 * Direction (P/L sign) drives the P/L color + the sparkline color. Closed/cancelled render their static
 * realized summary; a pending limit renders the waiting affordance. Nothing here places a real order
 * (`[no-real-order-path]`). Token discipline: colors via palette tokens, figures via the mono family.
 */
import { typographyTokens } from '@/shared/theme/tokens';
import { Box } from '@mui/material';
import type { DerivedRow } from './derive';
import { money } from './labels';
import {
  cellContent,
  ClosedSummary,
  formatExpiry,
  PendingAffordance,
  RowContext,
} from './PositionRow';
import { STRUCTURE_LABELS } from './structure';

const monoSx = typographyTokens.monoFontFamily;
const pctStr = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}%`;

const rowActionSx = {
  cursor: 'pointer',
  border: '1px solid',
  borderColor: 'divider',
  background: 'transparent',
  font: 'inherit',
  fontSize: '0.76rem',
  color: 'text.secondary',
  borderRadius: '6px',
  padding: '3px 9px',
} as const;

export interface PositionCardProps {
  row: DerivedRow;
  ctx: RowContext;
  streamOffline: boolean;
  onClose: (id: string) => void;
}

export function PositionCard({ row, ctx, streamOffline, onClose }: PositionCardProps) {
  const p = row.position;
  const mtr = row.metrics;
  const isTerminal = p.status === 'closed' || p.status === 'cancelled';
  const liveDim = streamOffline ? 0.5 : 1;
  const plColor =
    mtr.plDollar == null ? 'text.primary' : mtr.plDollar >= 0 ? 'success.main' : 'error.main';
  const strikeLeg = `$${p.strike} ${p.right === 'call' ? 'Call' : 'Put'}`;
  const strategyName = STRUCTURE_LABELS[row.structure];
  // Footer Mark value (Figma: bold mono, matches Qty/Entry). Compact states inline (no chip/tag in the
  // footer); the live block + this value dim together on offline via `liveDim`.
  const markRes = ctx.markRes;
  const markStr =
    p.status === 'pending'
      ? `limit $${(p.limit_price ?? 0).toFixed(2)}`
      : mtr.unavailable || markRes?.mark == null
        ? '—'
        : `${markRes.basis === 'modeled' ? '≈ ' : ''}$${markRes.mark.toFixed(2)}`;
  // Figma footer value: Roboto Mono Bold 700, primary; the label inherits the footer's secondary 0.76rem.
  const footValSx = { fontFamily: monoSx, fontWeight: 700, color: 'text.primary' } as const;
  return (
    <Box
      data-testid="position-card"
      data-id={p.id}
      data-status={p.status}
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '10px',
        padding: '15px',
      }}
    >
      {/* Top row: symbol + leg / strategy chip. */}
      <Box
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '12px' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Box component="span" sx={{ fontFamily: monoSx, fontWeight: 700, fontSize: '1rem' }}>
            {p.ticker}
          </Box>
          <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
            {strikeLeg}
          </Box>
        </Box>
        <Box
          component="span"
          sx={{
            fontSize: '0.7rem',
            color: 'text.disabled',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '5px',
            padding: '2px 7px',
          }}
        >
          {strategyName}
        </Box>
      </Box>

      {/* Middle row: big P/L + % / sparkline (the live block — dims offline). */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          opacity: liveDim,
        }}
        data-testid="card-pl"
      >
        <Box>
          <Box
            component="div"
            sx={{
              fontFamily: monoSx,
              fontWeight: 700,
              fontSize: '1.5rem',
              color: plColor,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {p.status === 'open' && mtr.plDollar != null ? money(mtr.plDollar) : '—'}
          </Box>
          <Box component="div" sx={{ fontFamily: monoSx, fontSize: '0.85rem', color: plColor }}>
            {p.status === 'open' && mtr.plPct != null ? pctStr(mtr.plPct) : ''}
          </Box>
        </Box>
        <Box>{cellContent('trend', ctx)}</Box>
      </Box>

      {/* Footer: Qty · Entry · Mark · expiry (labels secondary, values bold mono primary — Figma). */}
      <Box
        sx={{
          display: 'flex',
          gap: '16px',
          mt: '12px',
          pt: '12px',
          borderTop: '1px solid',
          borderColor: 'divider',
          fontSize: '0.76rem',
          color: 'text.secondary',
          alignItems: 'center',
        }}
      >
        <Box component="span">
          Qty{' '}
          <Box component="span" sx={footValSx}>
            {p.qty}
          </Box>
        </Box>
        <Box component="span">
          Entry{' '}
          <Box component="span" sx={footValSx}>
            ${p.entry_mark.toFixed(2)}
          </Box>
        </Box>
        <Box component="span" sx={{ opacity: liveDim }} data-testid="card-mark">
          Mark{' '}
          <Box component="span" sx={footValSx}>
            {markStr}
          </Box>
        </Box>
        <Box component="span" sx={{ ml: 'auto' }}>
          {formatExpiry(p.expiration)}
        </Box>
      </Box>

      {isTerminal && (
        <Box sx={{ mt: '10px' }}>
          <ClosedSummary row={row} />
        </Box>
      )}
      {p.status === 'pending' && <PendingAffordance ctx={ctx} />}
      {p.status === 'open' && (
        <Box sx={{ mt: '10px' }}>
          <Box component="button" type="button" onClick={() => onClose(p.id)} sx={rowActionSx}>
            Close
          </Box>
        </Box>
      )}
    </Box>
  );
}

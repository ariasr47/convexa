/**
 * PositionCard (convexa-redesign · Positions — Figma PositionCard `108:58`). The mobile projection of
 * one position, rebuilt on the `PositionView` projection (SPEC §4 *The mobile card at 393px*).
 *
 * SIX SLOTS, and a card's COLLAPSED height is identical for a 1-leg and a 4-leg position — leg count
 * changes ONE label and nothing else:
 *   1 header    — `TSLA` (mono 700, 1rem) + the structure line · the structure chip, right-aligned.
 *                 The structure line gets `minWidth: 0` + ellipsis; THE CHIP NEVER SHRINKS. (A flex
 *                 child without `minWidth: 0` is the classic 393px offender.)
 *   2 live block— big mono P/L + P/L% (left) · sparkline (right); dims to 0.5 offline.
 *   3 footer    — EXACTLY FIVE items: Qty · Net debit/credit · Mark · expiry · THE RISK SLOT. The
 *                 risk slot carries EITHER the max-loss figure OR its one stated reason, never both,
 *                 never three figures. `Entry` is RELABELLED, not joined by a new item.
 *   4 disclosure— `4 legs ⌄`, full-width-left, ≥44px hit target, `text.secondary`. Absent at 1 leg.
 *   5 expansion — one line per leg, STACKED VERTICALLY. Never a horizontal mini-table at 393px.
 *   6 actions   — Close / pending affordance / closed summary, unchanged.
 *
 * Direction (P/L sign) drives the P/L colour + the sparkline colour, and NOTHING else on this card:
 * the structure chip, the debit/credit qualifier and the risk slot are untinted (AC-78). Nothing
 * here places a real order (`[no-real-order-path]`). Token discipline: colours via palette tokens,
 * figures via the mono family; zero hardcoded hex.
 */
import { typographyTokens } from '@/shared/theme/tokens';
import { Box } from '@mui/material';
import { useId, useState } from 'react';
import { MAX_LOSS_LABEL, MAX_LOSS_WITHHELD_META, money } from './labels';
import { LegDisclosureButton, LegDisclosurePanel } from './LegDisclosure';
import {
  cellContent,
  ClosedSummary,
  formatExpiry,
  PendingAffordance,
  rowActionSx,
  RowContext,
} from './PositionRow';
import { STRUCTURE_LABELS } from './structure';
import type { PositionView } from './view';

const monoSx = typographyTokens.monoFontFamily;
const pctStr = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}%`;
const dollars = (n: number) => `$${Math.abs(Math.round(n))}`;
const netMoney = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n))}`;

export interface PositionCardProps {
  view: PositionView;
  ctx: RowContext;
  streamOffline: boolean;
  onClose: (id: string) => void;
}

export function PositionCard({ view, ctx, streamOffline, onClose }: PositionCardProps) {
  const p = view.position;
  const [expanded, setExpanded] = useState(false); // EPHEMERAL — never persisted, gone after reload
  const panelId = useId();
  const isTerminal = p.status === 'closed' || p.status === 'cancelled';
  const liveDim = streamOffline ? 0.5 : 1;
  const plColor =
    view.pl_dollar == null ? 'text.primary' : view.pl_dollar >= 0 ? 'success.main' : 'error.main';
  const markStr =
    p.status === 'pending'
      ? `limit $${(p.limit_price ?? 0).toFixed(2)}`
      : view.mark.unavailable || view.mark.net_mark == null
        ? 'unavailable'
        : `${view.mark.basis === 'modeled' ? '≈ ' : ''}${netMoney(view.mark.net_mark)}`;
  // Multi-expiry shows the NEAREST expiry with a `+N more` suffix — never two dates in one slot.
  const expiryStr =
    view.nearest_expiration == null
      ? '—'
      : `${formatExpiry(view.nearest_expiration)}${
          view.expiration_count > 1 ? ` +${view.expiration_count - 1} more` : ''
        }`;
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
      {/* 1 — header: symbol + structure line / structure chip. */}
      <Box
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '12px' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <Box
            component="span"
            sx={{ fontFamily: monoSx, fontWeight: 700, fontSize: '1rem', flexShrink: 0 }}
          >
            {p.legs[0]?.ticker}
          </Box>
          <Box
            component="span"
            title={view.structure_line_full}
            data-testid="card-structure-line"
            sx={{
              color: 'text.secondary',
              fontSize: '0.85rem',
              // THE 393px OFFENDER: a flex child without `minWidth: 0` refuses to shrink and pushes
              // the chip off the card. The collapse itself is authored in the string; this is only
              // the last-resort clamp.
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {view.structure_line_collapsed}
          </Box>
        </Box>
        <Box
          component="span"
          data-testid="card-structure-chip"
          sx={{
            fontSize: '0.7rem',
            color: 'text.disabled',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '5px',
            padding: '2px 7px',
            flexShrink: 0, // the chip NEVER shrinks
            whiteSpace: 'nowrap',
            ml: '8px',
          }}
        >
          {STRUCTURE_LABELS[view.structure]}
        </Box>
      </Box>

      {/* 2 — the LIVE block: big P/L + % / sparkline. Dims offline; nothing else on the card does. */}
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
            {p.status === 'open' && view.pl_dollar != null ? money(view.pl_dollar) : '—'}
          </Box>
          <Box component="div" sx={{ fontFamily: monoSx, fontSize: '0.85rem', color: plColor }}>
            {p.status === 'open' && view.pl_pct.kind === 'value' ? pctStr(view.pl_pct.value) : ''}
          </Box>
        </Box>
        <Box>{cellContent('trend', ctx)}</Box>
      </Box>

      {/* 3 — footer: EXACTLY five items (labels secondary, values bold mono primary — Figma). */}
      <Box
        data-testid="card-footer"
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
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
            {view.qty_text}
          </Box>
        </Box>
        <Box component="span">
          {view.net_entry_basis === 'net_debit' ? 'Net debit' : 'Net credit'}{' '}
          <Box component="span" sx={footValSx} data-testid="card-net-entry">
            {dollars(view.net_entry_cost)}
          </Box>
        </Box>
        {/* The dim lives on THIS element, which keeps `card-mark`'s shipped identity as the
            className-identity probe for the offline treatment. */}
        <Box component="span" sx={{ opacity: liveDim }} data-testid="card-mark">
          Mark{' '}
          <Box component="span" sx={footValSx} data-testid="card-mark-value">
            {markStr}
          </Box>
        </Box>
        <Box component="span">{expiryStr}</Box>
        {/* THE RISK SLOT — static, never dims, never tinted. ONE figure or ONE reason, never both. */}
        <Box component="span" data-testid="card-risk-slot" sx={{ ml: 'auto' }}>
          {MAX_LOSS_LABEL}{' '}
          {view.max_loss.kind === 'figure' ? (
            <Box component="span" sx={footValSx} data-testid="card-max-loss">
              {dollars(view.max_loss.dollars)}
            </Box>
          ) : (
            <Box component="span" sx={{ color: 'text.disabled' }} data-testid="card-max-loss">
              {MAX_LOSS_WITHHELD_META[view.max_loss.reason].label}
            </Box>
          )}
        </Box>
      </Box>

      {/* 4 + 5 — the disclosure and its panel. Absent entirely for a 1-leg position. */}
      {view.legs.length > 1 && (
        <Box sx={{ mt: '10px' }}>
          <LegDisclosureButton
            expanded={expanded}
            onToggle={() => setExpanded((v) => !v)}
            panelId={panelId}
            legCount={view.legs.length}
            variant="card"
          />
          <LegDisclosurePanel id={panelId} view={view} expanded={expanded} />
        </Box>
      )}

      {/* 6 — actions. */}
      {isTerminal && (
        <Box sx={{ mt: '10px' }}>
          <ClosedSummary view={view} />
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

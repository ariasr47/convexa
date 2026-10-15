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
 *
 * REGISTER + OFFLINE (curvature-v2-surfaces SPEC §2.3). The big P/L block and the Mark footer value
 * resolve their text through the SAME `markFigure`/`plFigure`/`plPctFigure` helpers `PositionRow`
 * exports, and their register/dim/pause treatment through `shared/figure`'s `figureStateOf` — so the
 * table and the card can never disagree about a datum (decisions.md §3 #13). The card keeps its own
 * HERO size (1.5rem) — the ladder does not travel — but the closed-nine text and the offline
 * treatment are the identical facts the row renders.
 */
import { faceFor, figureStateOf, PauseMark } from '@/shared/figure';
import { downText, upText } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useId, useState } from 'react';
import { Refused } from './FaultedBanner';
import { MAX_LOSS_LABEL, MAX_LOSS_WITHHELD_META } from './labels';
import { LegDisclosureButton, LegDisclosurePanel } from './LegDisclosure';
import { MarkNotLiveTag, SampleMarkTag, useMarkFeed } from './markFeed';
import {
  cellContent,
  ClosedSummary,
  formatExpiry,
  markFigure,
  PendingAffordance,
  plFigure,
  plPctFigure,
  rowActionSx,
  RowContext,
} from './PositionRow';
import { STRUCTURE_LABELS } from './structure';
import type { PositionView } from './view';

const dollars = (n: number) => `$${Math.abs(Math.round(n))}`;

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
  const isOpen = p.status === 'open';
  const plColor = view.pl_dollar == null ? 'text.primary' : view.pl_dollar >= 0 ? upText : downText;

  // The BIG P/L block and the Mark footer value read the SAME text/state the row's `cell-pl` and
  // `cell-mark` render, from the shared helpers `PositionRow` exports — the table and this card can
  // never disagree about a datum (decisions.md §3 #13). Gated on `isOpen`/`pending` exactly as
  // shipped: the hero block is only meaningful for an open position, and a pending row's Mark is its
  // resting limit, never a live figure.
  const plFig = plFigure(view);
  const plState = figureStateOf({
    value: plFig.text,
    register: 'traced',
    offline: streamOffline ? { retained: plFig.hasValue } : null,
  });
  const pctFig = plPctFigure(view);
  const markFig = p.status === 'pending' ? null : markFigure(view);
  const markState = markFig
    ? figureStateOf({
        value: markFig.text,
        register: 'traced',
        offline: streamOffline ? { retained: markFig.hasValue } : null,
      })
    : null;
  const feed = useMarkFeed();
  const markNotLive = feed === 'notLive' && markFig != null && !markFig.hasValue;
  const markText =
    p.status === 'pending'
      ? `limit $${(p.limit_price ?? 0).toFixed(2)}`
      : markNotLive
        ? '—'
        : (markFig?.text ?? '');
  // Canon P-2/P-3: a demo mark names the sample chain; with no feed on this site, Mark not live.
  const markTag = markNotLive ? (
    <MarkNotLiveTag />
  ) : feed === 'sample' && markFig?.hasValue && view.mark.basis !== 'manual' ? (
    <SampleMarkTag />
  ) : null;

  // Multi-expiry shows the NEAREST expiry with a `+N more` suffix — never two dates in one slot.
  const expiryStr =
    view.nearest_expiration == null
      ? '—'
      : `${formatExpiry(view.nearest_expiration)}${
          view.expiration_count > 1 ? ` +${view.expiration_count - 1} more` : ''
        }`;
  // Figma footer value: Roboto Mono Bold 700, primary; the label inherits the footer's secondary 0.76rem.
  const footValSx = { ...faceFor(true), fontWeight: 700, color: 'text.primary' } as const;
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
            sx={{ ...faceFor(true), fontWeight: 700, fontSize: '1rem', flexShrink: 0 }}
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
            color: 'text.secondary',
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

      {/* 2 — the LIVE block: big P/L + % / sparkline. Dims + pauses offline; nothing else on the
          card does (SPEC §2.3, criteria 27a/27b/28/29 — the same offline contract the row's
          `cell-pl` owes, via the SAME `plFigure`/`figureStateOf` facts). */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          // Blanket streamOffline, exactly as shipped (`liveDim`) — the wrapper does not gate on
          // `isOpen`; only the VALUE inside it does, unchanged from before this task.
          opacity: streamOffline ? 0.5 : 1,
        }}
        data-testid="card-pl"
      >
        <Box>
          <Box
            component="div"
            sx={{
              ...faceFor(isOpen ? plState.mono : true),
              fontWeight: 700,
              fontSize: '1.5rem',
              color: isOpen && !plState.mono ? 'text.disabled' : plColor,
            }}
          >
            {isOpen ? plFig.text : '—'}
          </Box>
          <Box
            component="div"
            sx={{
              ...faceFor(isOpen ? plState.mono : true),
              fontSize: '0.85rem',
              color: isOpen && !plState.mono ? 'text.disabled' : plColor,
            }}
          >
            {isOpen ? pctFig.text : ''}
          </Box>
          {isOpen && plState.showPause && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px', mt: 0.25 }}>
              <PauseMark />
              {plState.caption && (
                <Typography
                  component="span"
                  variant="caption"
                  data-testid="card-pl-caption"
                  sx={{ color: 'text.disabled' }}
                >
                  {plState.caption}
                </Typography>
              )}
            </Box>
          )}
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
            className-identity probe for the offline treatment. Face/state come from `markFigure` +
            `figureStateOf` — the same facts `cell-mark` renders (decisions.md §3 #13). */}
        <Box
          component="span"
          sx={{
            // Blanket streamOffline, exactly as shipped (`liveDim`) — unchanged even for a pending
            // row's resting-limit text, which never sets `markState`.
            opacity: streamOffline ? 0.5 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '4px',
          }}
          data-testid="card-mark"
        >
          Mark{' '}
          <Box
            component="span"
            sx={{
              ...faceFor(markState ? markState.mono : true),
              fontWeight: 700,
              color: markState && !markState.mono ? 'text.disabled' : 'text.primary',
            }}
            data-testid="card-mark-value"
          >
            {markText}
          </Box>
          {markTag}
          {markState?.showPause && (
            <>
              <PauseMark />
              {markState.caption && (
                <Box
                  component="span"
                  data-testid="card-mark-caption"
                  sx={{ fontSize: '0.7rem', color: 'text.disabled', flexBasis: '100%' }}
                >
                  {markState.caption}
                </Box>
              )}
            </>
          )}
        </Box>
        <Box component="span">{expiryStr}</Box>
        {/* THE RISK SLOT — static, never dims, never tinted. ONE figure or ONE reason, never both.
            No `ml: auto`: with five items the footer wraps at 393px, and pushing the last one hard
            right leaves a ragged orphan line. Flowing them in the spec's left-to-right scan order
            wraps evenly and keeps the order readable (verified in a real browser at 393px). */}
        <Box component="span" data-testid="card-risk-slot">
          {MAX_LOSS_LABEL}{' '}
          {view.max_loss.kind === 'figure' ? (
            <Box component="span" sx={footValSx} data-testid="card-max-loss">
              {dollars(view.max_loss.dollars)}
            </Box>
          ) : (
            <Box component="span" sx={{ color: 'text.secondary' }} data-testid="card-max-loss">
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
          <Refused when={!!ctx.faulted}>
            <Box component="button" type="button" onClick={() => onClose(p.id)} sx={rowActionSx}>
              Close
            </Box>
          </Refused>
        </Box>
      )}
    </Box>
  );
}

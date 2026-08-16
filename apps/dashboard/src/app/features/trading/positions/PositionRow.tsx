/**
 * One position rendered as a set of cells (used by both table + card layouts).
 *
 * EVERY cell reads the `PositionView` projection and NOTHING else (SPEC §2.7): this component never
 * imports the store, never calls the recogniser, and never performs leg arithmetic or leg
 * formatting. If a cell needs a number that is not on the projection, that is a change to `view.ts`,
 * not a component reaching past the boundary — which is what lets these same components serve
 * sim-now and broker-later without a fork.
 *
 * Component states (SPEC §4): live cells (mark, P/L, P/L%, Δ since entry, Session Δ, trend) dim +
 * show `⏸ offline` + last-known on an SSE drop; STATIC cells (structure line, qty, net entry, MAX
 * LOSS, expiry, status) keep rendering and never dim. A leg's lookup failure withholds the whole
 * aggregate — never a partial sum — while per-leg truth stays visible in the disclosure. Pending
 * limits show the waiting affordance + Cancel; nothing here can place a real order.
 *
 * TWO FIGURES CHANGED UNITS FROM THE SHIPPED ROW, deliberately and together: `Net entry` and `Mark`
 * are now DOLLAR NETS (`$840`, `$500`), not per-unit prices (`$8.40`, `$5.00`). A per-unit price is
 * undefined for a covered call (its legs have different multipliers) — the exact shape this feature
 * exists to hold — and the projection carries only dollar nets by design. The row becomes
 * arithmetically legible as a result: mark − net entry = P/L.
 */
import { MARK_BASIS_META } from '@/features/trading/model/mark';
import { typographyTokens } from '@/shared/theme/tokens';
import { Box, Button, Chip, Stack, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useId, useState } from 'react';
import { Refused } from './FaultedBanner';
import {
  DELTA_ENTRY_TIP,
  ENTRY_BASIS_META,
  ENTRY_MODE_LABEL,
  LIMIT_TIP,
  MAX_LOSS_TIP,
  MAX_LOSS_WITHHELD_META,
  money,
  MULTI_LEG_STRIKE_TIP,
  NET_ENTRY_TIP,
  NO_BASIS_LABEL,
  NO_BASIS_TIP,
  NOT_RECORDED_TIP,
  partialMarkTip,
  pct,
  PENDING_PL_TIP,
  PL_TIP,
  plPctBasisTip,
  ROW_UNAVAILABLE_TIP,
  SESSION_DELTA_TIP,
  SHARES_FIELD_TIP,
  SIMULATED_TIP,
  STATUS_LABEL,
  STRUCTURE_TIP,
  TREND_TIP,
  UNPRICEABLE_RECORD_TIP,
  WEAKEST_BASIS_TIP,
} from './labels';
import { LegDisclosureButton, LegDisclosurePanel } from './LegDisclosure';
import { PlSparkline } from './PlSparkline';
import { STRUCTURE_LABELS } from './structure';
import type { ColumnKey } from './types';
import type { PlSample } from './useTrends';
import type { PositionView } from './view';

const OFFLINE = '⏸ offline';
/** Not-applicable. Keeps its shipped treatment and stays UNTESTIDDED (SPEC §4). */
const DASH = '—';
// Figma table cell numerics: Roboto Mono, 13.8px (0.86rem), letterSpacing 0 (MUI `body2` would
// otherwise force 0.875rem + its own letter-spacing). Spread LAST in each cell's sx so it wins.
const MONO = {
  fontFamily: typographyTokens.monoFontFamily,
  fontVariantNumeric: 'tabular-nums',
  fontSize: '0.86rem',
  letterSpacing: 0,
} as const;

/** UNSIGNED dollars — the qualifier word or the column header carries the direction. */
const dollars = (n: number) => `$${Math.abs(Math.round(n))}`;
/** Signed only when NEGATIVE (`$500`, `−$137`): a leading `+` on a valuation reads as a gain. */
const netMoney = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n))}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Frame "Expiry" format: `Mon DD · {dte}d` (e.g. `Jul 18 · 19d`). Parses the YYYY-MM-DD parts
 *  directly (no timezone drift) and computes days-to-expiry as pure calendar arithmetic, so it always
 *  shows even when live metrics are unavailable. Display-only — never feeds scoring/math. */
export function formatExpiry(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const md = `${MONTHS[m - 1]} ${d}`;
  const now = new Date();
  const dte = Math.max(
    0,
    Math.round(
      (Date.UTC(y, m - 1, d) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) /
        86400000,
    ),
  );
  return `${md} · ${dte}d`;
}

export interface RowContext {
  /** THE only source of numbers and strings for every cell (SPEC §2.7). */
  view: PositionView;
  trend: PlSample[];
  /** Ephemeral session Δ — a live-derived per-cycle datum, like `trend`; never persisted. */
  sessionDelta: number | null;
  streamOffline: boolean;
  /**
   * The durable store is faulted (SPEC §2.9). NOTHING dims and no ⏸ appears — faulted and offline
   * are independent states — but every WRITE affordance on the row is refused: `aria-disabled`,
   * still focusable, tooltip-reachable, and a no-op.
   */
  faulted?: boolean;
  onClose: (id: string) => void;
  onCancel: (id: string) => void;
  /** ai-rec-backtest-orders (AC-31): open the originating sim order's detail (positions created by
   *  an order fill carry `origin_order_id`). Optional — absent hosts render no backlink. */
  onViewOrder?: (orderId: string) => void;
}

function statusChipColor(status: string): 'default' | 'info' {
  return status === 'pending' ? 'info' : 'default';
}

/**
 * The four not-a-number literals share IDENTICAL treatment — `variant="body2"`,
 * `color: 'text.disabled'`, the same `Tooltip arrow` — and differ BY TEXT AND TESTID ONLY. They are
 * built here, once, so "let's shorten the unavailable cell" cannot quietly collapse two of them into
 * one (SPEC §4, AC-31). A degraded state is NEVER directional, so none of them is ever tinted.
 */
function literal(text: string, tip: string, testid?: string) {
  return (
    <Tooltip arrow title={tip}>
      <Typography variant="body2" sx={{ color: 'text.disabled' }} data-testid={testid}>
        {text}
      </Typography>
    </Tooltip>
  );
}
const unavailableCell = (view: PositionView) =>
  literal(
    'unavailable',
    // PERMANENT vs THIS-CYCLE: a record that can never be priced must not carry a promise of
    // transience (AC-32). Where some legs DID price, the tip names how many did not.
    view.unpriceable
      ? UNPRICEABLE_RECORD_TIP
      : view.mark.resolved_legs > 0
        ? partialMarkTip(view.mark.resolved_legs, view.mark.total_legs)
        : ROW_UNAVAILABLE_TIP,
    'cell-unavailable',
  );
const notRecordedCell = () => literal('not recorded', NOT_RECORDED_TIP, 'cell-not-recorded');
const dashCell = (tip: string) => literal(DASH, tip, undefined);

/** The three-way strike/right/expiry answer: not applicable · never recorded · one level down. */
type FactState = 'value' | 'shares' | 'multi_leg' | 'not_recorded';
function factStateOf(view: PositionView): FactState {
  const options = view.legs.filter((l) => l.instrument_kind === 'option');
  if (options.length === 0) return 'shares';
  if (view.position.legs.length > 1) return 'multi_leg';
  return view.position.legs[0].strike == null || view.position.legs[0].right == null
    ? 'not_recorded'
    : 'value';
}

/**
 * The disclosure control the `contract` cell carries at its right edge (F12). Passed down rather
 * than built here so `cellContent` stays a pure function of the projection: the expanded state is
 * ephemeral and owned by the host row/card.
 */
export interface DisclosureSlot {
  expanded: boolean;
  onToggle: () => void;
  panelId: string;
}

export function cellContent(
  col: ColumnKey,
  ctx: RowContext,
  disclosure?: DisclosureSlot,
): React.ReactNode {
  const { view, streamOffline } = ctx;
  const p = view.position;
  const [leg0] = p.legs;
  const isTerminal = p.status === 'closed' || p.status === 'cancelled';
  const liveDim = streamOffline ? 0.5 : 1;
  const offlineTag = streamOffline ? (
    <Typography
      component="span"
      variant="caption"
      data-testid="offline-tag"
      sx={{ color: 'text.disabled', display: 'block', flexBasis: '100%', lineHeight: 1.2 }}
    >
      {OFFLINE}
    </Typography>
  ) : null;
  const plColor =
    view.pl_dollar == null ? 'text.primary' : view.pl_dollar >= 0 ? 'success.main' : 'error.main';

  switch (col) {
    case 'simulated':
      return (
        <Tooltip arrow title={SIMULATED_TIP}>
          <Chip size="small" variant="outlined" label="SIMULATED" />
        </Tooltip>
      );
    case 'contract':
      // The frame's "Ticker" style: bold mono symbol + the secondary STRUCTURE LINE. Multi-leg must
      // not promote the descriptor — same weight, same size, one line, never wrapping. The collapse
      // is AUTHORED in the string (`$380…$460 condor (4 legs)`), never a CSS ellipsis mid-number;
      // the full strike list stays reachable in the title.
      return (
        <Stack
          direction="row"
          spacing={0.875}
          sx={{ alignItems: 'baseline' }}
          data-testid="cell-contract"
        >
          <Typography component="span" variant="body2" sx={{ ...MONO, fontWeight: 600 }}>
            {leg0?.ticker}
          </Typography>
          <Typography
            component="span"
            variant="body2"
            title={view.structure_line_full}
            sx={{ fontSize: '0.8rem', letterSpacing: 0, color: 'text.secondary' }}
            data-testid="structure-line"
          >
            {view.structure_line_collapsed}
          </Typography>
          {/* Present ONLY when the position has more than one leg (AC-35). */}
          {disclosure && view.legs.length > 1 && (
            <LegDisclosureButton
              expanded={disclosure.expanded}
              onToggle={disclosure.onToggle}
              panelId={disclosure.panelId}
              legCount={view.legs.length}
              variant="row"
            />
          )}
        </Stack>
      );
    case 'status':
      return (
        <Chip
          size="small"
          variant="outlined"
          color={statusChipColor(p.status)}
          sx={{ opacity: p.status === 'cancelled' ? 0.6 : 1 }}
          label={STATUS_LABEL[p.status]}
        />
      );
    case 'mode': {
      const mode = p.entry_mode ?? 'manual';
      // One chip only when EVERY leg shares an entry basis — a mixed-basis structure has no single
      // provenance to claim, and the disclosure carries each leg's own.
      const bases = new Set(p.legs.map((l) => l.entry_basis));
      const basisMeta = bases.size === 1 ? ENTRY_BASIS_META[[...bases][0]] : null;
      return (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Typography variant="body2">{ENTRY_MODE_LABEL[mode]}</Typography>
          {basisMeta && (
            <Tooltip arrow title={basisMeta.tip}>
              <Chip size="small" variant="outlined" label={basisMeta.label} />
            </Tooltip>
          )}
        </Stack>
      );
    }
    case 'mark': {
      if (p.status === 'pending') {
        return (
          <Tooltip arrow title={LIMIT_TIP}>
            <Typography variant="body2" sx={{ color: 'info.main' }}>
              limit ${(p.limit_price ?? 0).toFixed(2)}
            </Typography>
          </Tooltip>
        );
      }
      if (isTerminal) return dashCell(PENDING_PL_TIP);
      if (view.mark.unavailable || view.mark.net_mark == null) return unavailableCell(view);
      const basisMeta = MARK_BASIS_META[view.mark.basis];
      // The chip shows the WEAKEST leg basis — a structure containing a theoretical leg IS a
      // theoretical structure — and says so explicitly once the legs disagree.
      const mixed = new Set(view.legs.map((l) => l.basis).filter((b) => b != null)).size > 1;
      return (
        <Stack
          direction="row"
          spacing={0.5}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.25, opacity: liveDim }}
          data-testid="cell-mark"
        >
          <Typography variant="body2" sx={MONO}>
            {view.mark.basis === 'modeled' ? '≈ ' : ''}
            {netMoney(view.mark.net_mark)}
          </Typography>
          {basisMeta && (
            <Tooltip arrow title={mixed ? `${basisMeta.tip} ${WEAKEST_BASIS_TIP}` : basisMeta.tip}>
              <Chip size="small" variant="outlined" label={basisMeta.label} />
            </Tooltip>
          )}
          {offlineTag}
        </Stack>
      );
    }
    case 'pl': {
      if (p.status === 'pending') return dashCell(PENDING_PL_TIP);
      if (isTerminal) return dashCell(PENDING_PL_TIP);
      if (view.pl_dollar == null) return unavailableCell(view);
      return (
        <Stack
          direction="row"
          spacing={0.5}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.25, opacity: liveDim }}
          data-testid="cell-pl"
        >
          <Tooltip arrow title={PL_TIP}>
            <Typography variant="body2" sx={{ color: plColor, fontWeight: 600, ...MONO }}>
              {money(view.pl_dollar)}
            </Typography>
          </Tooltip>
          {offlineTag}
        </Stack>
      );
    }
    case 'pl_pct': {
      if (isTerminal) return dashCell(PENDING_PL_TIP);
      const st = view.pl_pct;
      // `no basis` is a CELL-level state, not a row-level one: Convexa holds BOTH numbers it needs
      // and the denominator is about zero, which is exactly why the dollar P/L beside it still
      // renders a real figure while this one does not (SPEC §4, AC-31).
      if (st.kind === 'no_basis') return literal(NO_BASIS_LABEL, NO_BASIS_TIP, 'cell-no-basis');
      if (st.kind === 'not_applicable') return dashCell(PENDING_PL_TIP);
      if (st.kind === 'unavailable') return unavailableCell(view);
      return (
        <Stack
          direction="row"
          spacing={0.5}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.25, opacity: liveDim }}
          data-testid="cell-pl-pct"
        >
          <Tooltip arrow title={plPctBasisTip(st.basis)}>
            <Typography variant="body2" sx={{ color: plColor, ...MONO }}>
              {pct(st.value)}
            </Typography>
          </Tooltip>
          {offlineTag}
        </Stack>
      );
    }
    case 'delta_entry': {
      if (p.status !== 'open') return dashCell(DELTA_ENTRY_TIP);
      return (
        <Tooltip arrow title={DELTA_ENTRY_TIP}>
          <Typography
            variant="body2"
            sx={{ opacity: liveDim, ...MONO, color: 'text.secondary' }}
            data-testid="cell-delta-entry"
          >
            {view.pl_dollar == null ? DASH : money(view.pl_dollar)}
            {streamOffline ? ' ⏸' : ''}
          </Typography>
        </Tooltip>
      );
    }
    case 'session_delta': {
      if (p.status !== 'open') return dashCell(SESSION_DELTA_TIP);
      return (
        <Tooltip arrow title={SESSION_DELTA_TIP}>
          <Typography variant="body2" sx={{ opacity: liveDim }} data-testid="cell-session-delta">
            {streamOffline ? '⏸' : ctx.sessionDelta == null ? DASH : money(ctx.sessionDelta)}
          </Typography>
        </Tooltip>
      );
    }
    case 'trend': {
      if (p.status !== 'open') return dashCell(TREND_TIP);
      return (
        <Tooltip arrow title={TREND_TIP}>
          <span>
            <PlSparkline samples={ctx.trend} offline={streamOffline} />
          </span>
        </Tooltip>
      );
    }
    case 'entry': {
      // The qualifier is derived from the SIGN, never from the structure name — a vertical can be
      // either. No abbreviation (`Dr`/`Cr`/`db`): abbreviating into an 11px floor is a slop tell.
      // The word is untinted: a credit is money received, not a gain (AC-78).
      return (
        <Tooltip arrow title={NET_ENTRY_TIP}>
          <Typography
            component="span"
            variant="body2"
            sx={{ ...MONO, color: 'text.secondary' }}
            data-testid="cell-entry"
          >
            {dollars(view.net_entry_cost)}{' '}
            {view.net_entry_basis === 'net_debit' ? 'debit' : 'credit'}
          </Typography>
        </Tooltip>
      );
    }
    case 'qty':
      return (
        <Tooltip arrow title={view.qty_tip}>
          <Typography variant="body2" sx={MONO} data-testid="cell-qty">
            {view.qty_text}
          </Typography>
        </Tooltip>
      );
    case 'expiry': {
      const state = factStateOf(view);
      if (state === 'shares') return dashCell(SHARES_FIELD_TIP);
      if (view.nearest_expiration == null) return notRecordedCell();
      // Multi-expiry structures carry their expiries IN the structure line; this column then shows
      // the NEAREST with the multi-expiry tip. Never two dates crammed into one slot.
      const body = (
        <Typography
          component="span"
          variant="body2"
          sx={{ fontSize: '0.8rem', color: 'text.secondary', letterSpacing: 0 }}
          data-testid="cell-expiry"
        >
          {formatExpiry(view.nearest_expiration)}
        </Typography>
      );
      return view.multi_expiration ? (
        <Tooltip arrow title={MULTI_LEG_STRIKE_TIP}>
          {body}
        </Tooltip>
      ) : (
        body
      );
    }
    case 'strike': {
      const state = factStateOf(view);
      if (state === 'shares') return dashCell(SHARES_FIELD_TIP);
      if (state === 'multi_leg') return dashCell(MULTI_LEG_STRIKE_TIP);
      if (state === 'not_recorded') return notRecordedCell();
      return <Typography variant="body2">${p.legs[0].strike}</Typography>;
    }
    case 'right': {
      const state = factStateOf(view);
      if (state === 'shares') return dashCell(SHARES_FIELD_TIP);
      if (state === 'multi_leg') return dashCell(MULTI_LEG_STRIKE_TIP);
      if (state === 'not_recorded') return notRecordedCell();
      return <Typography variant="body2">{p.legs[0].right === 'call' ? 'Call' : 'Put'}</Typography>;
    }
    case 'structure':
      // The outlined NEUTRAL chip: `divider` border, `text.secondary` ink, NO colour and not amber
      // (amber is spent on the one CTA). `Custom` renders in the SAME visual register as every
      // other name — no error styling, no alert colour, no icon (AC-15, AC-78).
      return (
        <Tooltip arrow title={STRUCTURE_TIP}>
          <Typography
            component="span"
            variant="body2"
            sx={{ fontSize: '0.78rem', color: 'text.secondary', letterSpacing: 0 }}
            data-testid="cell-structure"
          >
            {STRUCTURE_LABELS[view.structure]}
          </Typography>
        </Tooltip>
      );
    // The risk slot's TABLE home (`lg` and above only — SPEC §4 GATE Z ruling). STATIC: not
    // live-derived, so it NEVER dims, and untinted, because a risk figure is not a P/L direction
    // (AC-78). One unsigned figure, or ONE stated reason — never both, never blank, never `0`,
    // never a bare `—`, never the word `Unlimited` standing alone.
    case 'max_loss': {
      const ml = view.max_loss;
      return ml.kind === 'figure' ? (
        <Tooltip arrow title={MAX_LOSS_TIP}>
          <Typography component="span" variant="body2" sx={{ ...MONO }} data-testid="cell-max-loss">
            {dollars(ml.dollars)}
          </Typography>
        </Tooltip>
      ) : (
        <Tooltip arrow title={MAX_LOSS_WITHHELD_META[ml.reason].tip}>
          <Typography
            component="span"
            variant="body2"
            sx={{ color: 'text.disabled' }}
            data-testid="cell-max-loss"
          >
            {MAX_LOSS_WITHHELD_META[ml.reason].label}
          </Typography>
        </Tooltip>
      );
    }
    case 'dte':
      return <Typography variant="body2">{view.dte == null ? DASH : view.dte}</Typography>;
    case 'entry_time':
      return (
        <Typography variant="body2">
          {p.opened_time ? new Date(p.opened_time).toLocaleString() : DASH}
        </Typography>
      );
    case 'stop':
      return <Typography variant="body2">{p.stop == null ? DASH : `$${p.stop}`}</Typography>;
    case 'target':
      return <Typography variant="body2">{p.target == null ? DASH : `$${p.target}`}</Typography>;
    default:
      return null;
  }
}

/** The pending-limit affordance + Cancel (UX_BLUEPRINT §6 S7). */
export function PendingAffordance({ ctx }: { ctx: RowContext }) {
  const { view, streamOffline, onCancel } = ctx;
  const p = view.position;
  if (p.status !== 'pending') return null;
  const liveMark = view.mark.unavailable ? null : view.mark.net_mark;
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: 'center', mt: 0.5 }}
      data-testid="pending-affordance"
    >
      {streamOffline ? (
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          Paused — resumes pricing when the live feed returns. ⏸
        </Typography>
      ) : (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Waiting for mark ≤ ${(p.limit_price ?? 0).toFixed(2)}
          {liveMark != null ? ` (live ${netMoney(liveMark)})` : ''}
        </Typography>
      )}
      <Refused when={!!ctx.faulted}>
        <Button size="small" onClick={() => onCancel(p.id)}>
          Cancel
        </Button>
      </Refused>
    </Stack>
  );
}

/** Realized summary for a closed/cancelled position (static — UX_BLUEPRINT §6 S4 closed). */
export function ClosedSummary({ view }: { view: PositionView }) {
  const theme = useTheme();
  const p = view.position;
  if (p.status === 'cancelled') {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Cancelled · resting limit never filled
      </Typography>
    );
  }
  const held =
    p.close_time && p.opened_time
      ? Math.round((Date.parse(p.close_time) - Date.parse(p.opened_time)) / 60000)
      : 0;
  const r$ = p.realized_pl_dollar ?? 0;
  return (
    <Typography
      variant="body2"
      sx={{ color: r$ >= 0 ? theme.palette.success.main : theme.palette.error.main }}
    >
      Closed · realized {money(r$)} ({pct(p.realized_pl_pct ?? 0)}) · held{' '}
      {held < 60 ? `${held}m` : `${Math.floor(held / 60)}h ${held % 60}m`}
    </Typography>
  );
}

export const rowActionSx = {
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

/**
 * PositionRow (convexa-redesign · Positions — Figma PositionRow `106:52`). One position rendered as a
 * table `<tr>` of `cellContent` cells across the passed column set + a trailing actions cell.
 * Mono figures + direction-coloured P/L come from `cellContent`; live cells dim + show `⏸ offline`
 * on an SSE drop while static cells keep rendering. Nothing here places a real order.
 */
export function PositionRow({
  ctx,
  columns,
  tdPad,
  onClose,
}: {
  ctx: RowContext;
  columns: ColumnKey[];
  tdPad: string;
  onClose: (id: string) => void;
}) {
  const p = ctx.view.position;
  const isTerminal = p.status === 'closed' || p.status === 'cancelled';
  // EPHEMERAL disclosure state: never persisted, absent from `ViewConfig`, gone after reload.
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const hasLegs = ctx.view.legs.length > 1;
  const tdSx = {
    padding: tdPad,
    fontSize: '0.86rem',
    borderBottom: '1px solid',
    borderColor: 'divider',
    whiteSpace: 'nowrap' as const,
  };
  const actionTdSx = {
    ...tdSx,
    position: 'sticky' as const,
    right: 0,
    zIndex: 1,
    bgcolor: 'background.paper',
    borderLeft: '1px solid',
    borderLeftColor: 'divider',
  };
  return (
    <>
      <Box component="tr" data-testid="position-row" data-id={p.id} data-status={p.status}>
        {columns.map((c) => (
          <Box component="td" key={c} sx={tdSx}>
            {cellContent(c, ctx, {
              expanded,
              onToggle: () => setExpanded((v) => !v),
              panelId,
            })}
          </Box>
        ))}
        <Box component="td" sx={actionTdSx} data-testid="position-actions-cell">
          {p.status === 'open' && (
            <Refused when={!!ctx.faulted}>
              <Box component="button" type="button" onClick={() => onClose(p.id)} sx={rowActionSx}>
                Close
              </Box>
            </Refused>
          )}
          {p.status === 'pending' && <PendingAffordance ctx={ctx} />}
          {isTerminal && <ClosedSummary view={ctx.view} />}
          {/* ai-rec-backtest-orders (AC-31): the position→order backlink — provenance line for a
            position an order fill created (`origin_order_id`). Static (never dims). */}
          {p.origin_order_id && ctx.onViewOrder && (
            <Box
              component="button"
              type="button"
              data-testid="position-view-order"
              onClick={() => ctx.onViewOrder?.(p.origin_order_id as string)}
              sx={{
                display: 'block',
                mt: 0.5,
                background: 'none',
                border: 'none',
                p: 0,
                font: 'inherit',
                fontSize: '0.72rem',
                color: 'text.secondary',
                cursor: 'pointer',
                // Link-class provenance link binds `info` (stage-3 §4.2), never amber.
                '& > span': { color: 'info.main' },
              }}
            >
              From sim order · <Box component="span">view order →</Box>
            </Box>
          )}
        </Box>
      </Box>
      {/* A REAL table structure (Design direction ¶2): the expansion is a SIBLING `<tr colSpan>`
          driven by the `<button aria-expanded aria-controls>` in the contract cell above. */}
      {hasLegs && (
        <Box component="tr" data-testid="leg-disclosure-row" hidden={!expanded}>
          <Box component="td" colSpan={columns.length + 1} sx={{ ...tdSx, whiteSpace: 'normal' }}>
            <LegDisclosurePanel id={panelId} view={ctx.view} expanded={expanded} />
          </Box>
        </Box>
      )}
    </>
  );
}

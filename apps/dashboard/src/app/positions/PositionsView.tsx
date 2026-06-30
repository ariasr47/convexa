/**
 * The all-positions view (UX_BLUEPRINT §6 S2/S3/S4/S5/S9): renders the derived groups as a dense
 * table (default) or cards, with per-group P/L subtotals. Empty/filtered-empty states render copy,
 * never an error/blank. Closed/cancelled (history) rows render their static realized facts. Live
 * cells degrade via PositionRow; static cells keep rendering.
 *
 * Re-skin (convexa-redesign · Positions): the framed table (uppercase 0.7rem headers, panel-bordered
 * outer, panel-raised group-subtotal rows) + the 2-col cards grid per the frame.
 * REVISION 2 (owner 2026-06-29): the visible column set is the FIXED Figma set (`FIGMA_COLUMNS`) —
 * the table/cards render from it directly and IGNORE the passed `columns` (persisted `working.columns`)
 * for the visible set, so an existing user's old saved columns can't override the Figma layout; everyone
 * sees the same columns until column-customization returns. Header copy uses the terse table-header
 * map. `cellContent` (incl. the offline-dim live cells) is reused as-is.
 */
import { Box, Typography } from '@mui/material';
import type { DerivedGroup, DerivedRow } from './derive';
import type { ColumnKey, Density, LayoutMode } from './types';
import { COLUMN_LABELS, TABLE_HEADER_LABELS } from './defaults';
import { cellContent, PendingAffordance, ClosedSummary, formatExpiry, RowContext } from './PositionRow';
import type { PlSample } from './useTrends';
import { money, EMPTY_NO_POSITIONS, EMPTY_FILTERED, HISTORY_CAPTION } from './labels';
import { extras, typographyTokens } from '../tokens';

const monoSx = typographyTokens.monoFontFamily;
const pctStr = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}%`;

/**
 * REVISION 2 — the FIXED Figma column set (left→right). The table/cards render from this directly and
 * do NOT read the persisted `working.columns` for the visible set (an existing user's saved columns
 * must not override the Figma layout). `working.columns` stays in the model for when customization returns.
 */
const FIGMA_COLUMNS: ColumnKey[] = [
  'contract', 'strategy', 'qty', 'entry', 'mark', 'pl', 'pl_pct', 'delta_entry', 'trend', 'expiry',
];
const headerLabel = (c: ColumnKey) => (c === 'simulated' ? '' : TABLE_HEADER_LABELS[c] ?? COLUMN_LABELS[c]);

export interface ViewProps {
  groups: DerivedGroup[];
  columns: ColumnKey[];
  layout: LayoutMode;
  density: Density;
  streamOffline: boolean;
  /** Total positions in the (unfiltered) collection — distinguishes "no positions" vs "filtered empty". */
  totalCount: number;
  /** Is the active filter the closed/history view (status = closed/cancelled)? */
  isHistory: boolean;
  markResFor: (row: DerivedRow) => RowContext['markRes'];
  trendFor: (id: string) => PlSample[];
  onOpenEntry: () => void;
  onClearFilter: () => void;
  onClose: (id: string) => void;
  onCancel: (id: string) => void;
}

const openCtaSx = {
  mt: '12px', bgcolor: 'primary.main', color: 'primary.contrastText', border: 'none', font: 'inherit',
  padding: '8px 15px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
};
const clearLinkSx = {
  mt: '10px', background: 'none', border: 'none', font: 'inherit', color: 'primary.main',
  fontSize: '0.82rem', cursor: 'pointer', display: 'block',
};

export function PositionsView(props: ViewProps) {
  const { groups, totalCount, isHistory } = props;
  const visibleRowCount = groups.reduce((n, g) => n + g.rows.length, 0);

  if (visibleRowCount === 0) {
    if (isHistory) {
      return <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2 }} data-testid="history-empty">No closed or cancelled positions yet.</Typography>;
    }
    if (totalCount === 0) {
      return (
        <Box sx={{ mt: 2 }} data-testid="empty-no-positions">
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>{EMPTY_NO_POSITIONS}</Typography>
          <Box component="button" type="button" onClick={props.onOpenEntry} sx={openCtaSx}>+ Open simulated position</Box>
        </Box>
      );
    }
    return (
      <Box sx={{ mt: 2 }} data-testid="empty-filtered">
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>{EMPTY_FILTERED}</Typography>
        <Box component="button" type="button" onClick={props.onClearFilter} sx={clearLinkSx}>Clear filter</Box>
      </Box>
    );
  }

  return (
    <Box>
      {isHistory && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }} data-testid="history-caption">
          {HISTORY_CAPTION}
        </Typography>
      )}
      {props.layout === 'table'
        ? <TableLayout {...props} />
        : <CardLayout {...props} />}
    </Box>
  );
}

function ctxFor(props: ViewProps, row: DerivedRow): RowContext {
  return {
    row,
    markRes: props.markResFor(row),
    trend: props.trendFor(row.position.id),
    streamOffline: props.streamOffline,
    onClose: props.onClose,
    onCancel: props.onCancel,
  };
}

/** The mono group subtotal, success/error by sign (the static derived sum). */
function subtotalNode(group: DerivedGroup) {
  const excl = group.excludedCount > 0
    ? ` · ${group.excludedCount} position${group.excludedCount > 1 ? 's' : ''} excluded (unavailable)` : '';
  return (
    <Typography
      component="span"
      data-testid="subtotal"
      sx={{ fontSize: '0.78rem', color: 'text.secondary', fontWeight: 400 }}
    >
      Subtotal{' '}
      <Box component="span" sx={{ fontWeight: 600, color: group.subtotal >= 0 ? 'success.main' : 'error.main', fontVariantNumeric: 'tabular-nums' }}>
        {money(group.subtotal)}
      </Box>
      {excl}
    </Typography>
  );
}

// ---- Table layout ------------------------------------------------------------------------------

const thSx = {
  textAlign: 'left' as const, padding: '11px 12px', fontSize: '0.7rem', fontWeight: 600,
  letterSpacing: '.03em', textTransform: 'uppercase' as const, color: 'text.secondary',
  borderBottom: '1px solid', borderColor: 'divider', whiteSpace: 'nowrap' as const,
};

function TableLayout(props: ViewProps) {
  const { density } = props;
  const columns = FIGMA_COLUMNS; // REVISION 2 — fixed Figma set, not props.columns
  const isGrouped = props.groups.length > 1 || props.groups[0]?.key !== '__all__';
  const tdPad = density === 'compact' ? '7px 12px' : '12px';
  return (
    <Box
      sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '10px', overflow: 'hidden' }}
    >
      <Box component="table" data-testid="positions-table" data-density={density} sx={{ width: '100%', borderCollapse: 'collapse' }}>
        <Box component="thead">
          <Box component="tr">
            {columns.map((c) => (
              <Box component="th" key={c} sx={thSx}>{headerLabel(c)}</Box>
            ))}
            <Box component="th" sx={thSx} />
          </Box>
        </Box>
        <Box component="tbody">
          {props.groups.map((g) => (
            <GroupRows key={g.key} group={g} props={props} columns={columns} showHeader={isGrouped} tdPad={tdPad} />
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function GroupRows({ group, props, columns, showHeader, tdPad }: { group: DerivedGroup; props: ViewProps; columns: ColumnKey[]; showHeader: boolean; tdPad: string }) {
  const tdSx = {
    padding: tdPad, fontSize: '0.86rem', borderBottom: '1px solid', borderColor: 'divider', whiteSpace: 'nowrap' as const,
  };
  return (
    <>
      {showHeader && (
        <Box component="tr" data-testid="group-header" data-group={group.key}>
          <Box
            component="td"
            colSpan={columns.length + 1}
            sx={{ bgcolor: extras.panelRaised, padding: '8px 12px', fontSize: '0.78rem', fontWeight: 600 }}
          >
            <Box component="span" sx={{ opacity: props.streamOffline ? 0.85 : 1 }}>
              {group.label} ({group.rows.length}){'  '}
            </Box>
            {subtotalNode(group)}
            {props.streamOffline && <Box component="span" sx={{ color: 'text.disabled', ml: '6px' }}>⏸</Box>}
          </Box>
        </Box>
      )}
      {group.rows.map((row) => {
        const ctx = ctxFor(props, row);
        const isTerminal = row.position.status === 'closed' || row.position.status === 'cancelled';
        return (
          <Box component="tr" key={row.position.id} data-testid="position-row" data-id={row.position.id} data-status={row.position.status}>
            {columns.map((c) => <Box component="td" key={c} sx={tdSx}>{cellContent(c, ctx)}</Box>)}
            <Box component="td" sx={tdSx}>
              {row.position.status === 'open' && (
                <Box component="button" type="button" onClick={() => props.onClose(row.position.id)} sx={rowActionSx}>Close</Box>
              )}
              {row.position.status === 'pending' && <PendingAffordance ctx={ctx} />}
              {isTerminal && <ClosedSummary row={row} />}
            </Box>
          </Box>
        );
      })}
    </>
  );
}

const rowActionSx = {
  cursor: 'pointer', border: '1px solid', borderColor: 'divider', background: 'transparent',
  font: 'inherit', fontSize: '0.76rem', color: 'text.secondary', borderRadius: '6px', padding: '3px 9px',
};

// ---- Cards layout ------------------------------------------------------------------------------

function CardLayout(props: ViewProps) {
  const { density } = props;
  const isGrouped = props.groups.length > 1 || props.groups[0]?.key !== '__all__';
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: isGrouped ? '18px' : '12px' }} data-testid="positions-cards" data-density={density}>
      {props.groups.map((g) => (
        <Box key={g.key}>
          {isGrouped && (
            <Box sx={{ mb: '8px', fontSize: '0.82rem', fontWeight: 600 }} data-testid="group-header" data-group={g.key}>
              {g.label} ({g.rows.length}) · {subtotalNode(g)}
            </Box>
          )}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {g.rows.map((row) => (
              <PositionCard key={row.position.id} props={props} row={row} />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function PositionCard({ props, row }: { props: ViewProps; row: DerivedRow }) {
  const ctx = ctxFor(props, row);
  const p = row.position;
  const mtr = row.metrics;
  const isTerminal = p.status === 'closed' || p.status === 'cancelled';
  const liveDim = props.streamOffline ? 0.5 : 1;
  const plColor = mtr.plDollar == null ? 'text.primary' : mtr.plDollar >= 0 ? 'success.main' : 'error.main';
  const strikeLeg = `$${p.strike} ${p.right === 'call' ? 'Call' : 'Put'}`;
  const strategyName = row.strategy === 'long_call' ? 'Long call' : 'Long put';
  // Footer Mark value (Figma: bold mono, matches Qty/Entry). Compact states inline (no chip/tag in the
  // footer); the live block + this value dim together on offline via `liveDim`.
  const markRes = ctx.markRes;
  const markStr = p.status === 'pending'
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
      sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '10px', padding: '15px' }}
    >
      {/* Top row: symbol + leg / strategy chip. */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '12px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Box component="span" sx={{ fontFamily: monoSx, fontWeight: 700, fontSize: '1rem' }}>{p.ticker}</Box>
          <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>{strikeLeg}</Box>
        </Box>
        <Box component="span" sx={{ fontSize: '0.7rem', color: 'text.disabled', border: '1px solid', borderColor: 'divider', borderRadius: '5px', padding: '2px 7px' }}>
          {strategyName}
        </Box>
      </Box>

      {/* Middle row: big P/L + % / sparkline (the live block — dims offline). */}
      <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', opacity: liveDim }} data-testid="card-pl">
        <Box>
          <Box component="div" sx={{ fontFamily: monoSx, fontWeight: 700, fontSize: '1.5rem', color: plColor, fontVariantNumeric: 'tabular-nums' }}>
            {p.status === 'open' && mtr.plDollar != null ? money(mtr.plDollar) : '—'}
          </Box>
          <Box component="div" sx={{ fontFamily: monoSx, fontSize: '0.85rem', color: plColor }}>
            {p.status === 'open' && mtr.plPct != null ? pctStr(mtr.plPct) : ''}
          </Box>
        </Box>
        <Box>{cellContent('trend', ctx)}</Box>
      </Box>

      {/* Footer: Qty · Entry · Mark · expiry (labels secondary, values bold mono primary — Figma). */}
      <Box sx={{ display: 'flex', gap: '16px', mt: '12px', pt: '12px', borderTop: '1px solid', borderColor: 'divider', fontSize: '0.76rem', color: 'text.secondary', alignItems: 'center' }}>
        <Box component="span">Qty <Box component="span" sx={footValSx}>{p.qty}</Box></Box>
        <Box component="span">Entry <Box component="span" sx={footValSx}>${p.entry_mark.toFixed(2)}</Box></Box>
        <Box component="span" sx={{ opacity: liveDim }} data-testid="card-mark">Mark <Box component="span" sx={footValSx}>{markStr}</Box></Box>
        <Box component="span" sx={{ ml: 'auto' }}>{formatExpiry(p.expiration)}</Box>
      </Box>

      {isTerminal && <Box sx={{ mt: '10px' }}><ClosedSummary row={row} /></Box>}
      {p.status === 'pending' && <PendingAffordance ctx={ctx} />}
      {p.status === 'open' && (
        <Box sx={{ mt: '10px' }}>
          <Box component="button" type="button" onClick={() => props.onClose(p.id)} sx={rowActionSx}>Close</Box>
        </Box>
      )}
    </Box>
  );
}

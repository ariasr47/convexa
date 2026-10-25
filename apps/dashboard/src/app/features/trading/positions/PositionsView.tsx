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
import { PauseMark } from '@/shared/figure';
import { downText, extrasFor, upText } from '@/shared/theme/tokens';
import { coarseFloor } from '@/shared/ui/touch';
import Box from '@mui/material/Box';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { COLUMN_LABELS, TABLE_HEADER_LABELS } from './defaults';
import type { DerivedGroup } from './derive';
import {
  EMPTY_FAULTED,
  EMPTY_FILTERED,
  EMPTY_NO_POSITIONS,
  HISTORY_CAPTION,
  money,
} from './labels';
import { SampleMarksChip, sampleMarksLine, useMarkFeed } from './markFeed';
import { PositionCard } from './PositionCard';
import { NUMERIC_COLUMNS, PositionRow, RowContext } from './PositionRow';
import type { ColumnKey, Density, LayoutMode } from './types';
import type { PlSample } from './useTrends';
import type { PositionView } from './view';

/**
 * REVISION 2 — the FIXED Figma column set (left→right). The table/cards render from this directly and
 * do NOT read the persisted `working.columns` for the visible set (an existing user's saved columns
 * must not override the Figma layout). `working.columns` stays in the model for when customization returns.
 *
 * `max_loss` sits between `trend` and `expiry`, matching SPEC §4 Flows 2's left→right scan order.
 * It is RENDERED ONLY AT `lg` AND ABOVE — see `visibleColumnsFor` below and the GATE Z ruling.
 *
 * `structure` is no longer its own column (fidelity audit 2026-10-25, ACC-09): the Final board names
 * the structure on the contract cell's second line (`Long call · opened 2:25 PM`), which now carries
 * the `cell-structure` name, so the column only repeated it. `structure` stays a stored column key
 * (DEFAULT_COLUMNS) and a group and sort axis; only the rendered set dropped it.
 *
 * MEASURED in a real browser (Cypress, seeded portfolio, both schemes, both densities):
 *   1440px · 1280px — the table fits its host and the page does not scroll. PASSES.
 *   900px (the md boundary, the NARROWEST width the table renders at) — WITH the column the table
 *     overflows its host: scrollWidth 895 vs clientWidth 835. WITHOUT it, the table fits.
 *     (The PAGE also overflows at 900px — 965 vs 900 — but that is PRE-EXISTING and byte-identical
 *     with and without the column; the shipped 393px e2e never covered the md boundary.)
 * SPEC §4 requires the column to fit "every shipped breakpoint ABOVE `md`"; MUI's `md` is 900px, so
 * `lg` and 1440 are what the constraint covers and both pass. GATE Z RULED 2026-07-28: the column
 * renders at `lg`+ and is not rendered at `md` and below, where the card's footer slot 5 carries the
 * figure. A failure at `lg` or above remains a BOUNCE, never a squeeze.
 *
 * That the table ignores the persisted `working.columns` is WHY AC-82 holds structurally today: no
 * saved view's stored column list gains `max_loss`, because no saved view drives this list. That is
 * a consequence of the fixed set, NOT a designed safeguard — a later refactor restoring column
 * customization removes the guarantee and must re-establish it deliberately.
 */
export const FIGMA_COLUMNS: ColumnKey[] = [
  'contract',
  'qty',
  'entry',
  'mark',
  'pl',
  'pl_pct',
  'delta_entry',
  'trend',
  'max_loss',
  'expiry',
];

/**
 * The ONE derivation of the rendered column set. Deliberately NOT a second `FIGMA_COLUMNS` constant:
 * two lists is exactly the drift `defaults.spec.ts` exists to prevent.
 *
 * The gate belongs on the RENDERED set and never on `DEFAULT_COLUMNS`/`OPTIONAL_COLUMNS` — a
 * viewport must never change what is STORED, which is the guarantee AC-82 asserts against storage.
 */
export function visibleColumnsFor(isLgUp: boolean): ColumnKey[] {
  return isLgUp ? FIGMA_COLUMNS : FIGMA_COLUMNS.filter((c) => c !== 'max_loss');
}
/** The contract column's header reads `Contract`, as the board's does: the cell names the
 *  contract (`SPY 690 C · Oct 16`), not only its ticker (fidelity ACC-09). */
const headerLabel = (c: ColumnKey) =>
  c === 'simulated'
    ? ''
    : c === 'contract'
      ? 'Contract'
      : (TABLE_HEADER_LABELS[c] ?? COLUMN_LABELS[c]);

export interface ViewProps {
  groups: DerivedGroup[];
  columns: ColumnKey[];
  layout: LayoutMode;
  density: Density;
  streamOffline: boolean;
  /** The durable store is faulted (SPEC §2.9) — refuses every write affordance, dims nothing. */
  faulted?: boolean;
  /** Total positions in the (unfiltered) collection — distinguishes "no positions" vs "filtered empty". */
  totalCount: number;
  /** Is the active filter the closed/history view (status = closed/cancelled)? */
  isHistory: boolean;
  trendFor: (id: string) => PlSample[];
  /** The ephemeral session Δ per position (the `trendFor` precedent). Absent ⇒ the honest `null`. */
  sessionDeltaFor?: (id: string) => number | null;
  onOpenEntry: () => void;
  onClearFilter: () => void;
  onClose: (id: string) => void;
  onCancel: (id: string) => void;
  /** ai-rec-backtest-orders (AC-31): open the originating sim order's detail. Optional — absent
   *  hosts render no backlink. */
  onViewOrder?: (orderId: string) => void;
}

const openCtaSx = {
  mt: '12px',
  bgcolor: 'primary.main',
  color: 'primary.contrastText',
  border: 'none',
  font: 'inherit',
  padding: '8px 15px',
  borderRadius: '8px',
  fontSize: '0.82rem',
  fontWeight: 700,
  cursor: 'pointer',
  ...coarseFloor,
};
const clearLinkSx = {
  mt: '10px',
  background: 'none',
  border: 'none',
  font: 'inherit',
  // Link-class text binds `info` (stage-3 §4.2: links are signal-blue, never amber).
  color: 'info.main',
  fontSize: '0.82rem',
  cursor: 'pointer',
  display: 'block',
  ...coarseFloor,
};

export function PositionsView(props: ViewProps) {
  const { groups, totalCount, isHistory } = props;
  const visibleRowCount = groups.reduce((n, g) => n + g.views.length, 0);
  // The multi-column table overflows a phone; below md we always render cards regardless of the
  // saved layout preference (which stays honored at md+). MUI's useMediaQuery is SSR/test-safe
  // (no matchMedia ⇒ false ⇒ desktop table), so existing table specs are unaffected.
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'));
  // The GATE Z gate, derived HERE beside the card fallback so there is exactly one place a viewport
  // decides what renders — and nowhere a viewport decides what is stored.
  const isLgUp = useMediaQuery(theme.breakpoints.up('lg'));
  const visibleColumns = visibleColumnsFor(isLgUp);
  const effectiveLayout: LayoutMode = isNarrow ? 'card' : props.layout;

  if (visibleRowCount === 0) {
    if (isHistory) {
      return (
        <Typography
          variant="body2"
          sx={{ color: 'text.secondary', mt: 2 }}
          data-testid="history-empty"
        >
          No closed or cancelled positions yet.
        </Typography>
      );
    }
    // FAULTED + ZERO ROWS is its own state (AC-67). The normal "no positions yet" copy is never
    // shown here: it would tell a trader with a damaged blob that they have no history, which is
    // both false and the single most alarming thing this surface could say.
    if (props.faulted) {
      return (
        <Box sx={{ mt: 2 }} data-testid="empty-faulted">
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {EMPTY_FAULTED}
          </Typography>
        </Box>
      );
    }
    if (totalCount === 0) {
      return (
        <Box sx={{ mt: 2 }} data-testid="empty-no-positions">
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {EMPTY_NO_POSITIONS}
          </Typography>
          <Box component="button" type="button" onClick={props.onOpenEntry} sx={openCtaSx}>
            + Open simulated position
          </Box>
        </Box>
      );
    }
    return (
      <Box sx={{ mt: 2 }} data-testid="empty-filtered">
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {EMPTY_FILTERED}
        </Typography>
        <Box component="button" type="button" onClick={props.onClearFilter} sx={clearLinkSx}>
          Clear filter
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      {isHistory && (
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', display: 'block', mb: 1 }}
          data-testid="history-caption"
        >
          {HISTORY_CAPTION}
        </Typography>
      )}
      {effectiveLayout === 'table' ? (
        <TableLayout {...props} visibleColumns={visibleColumns} />
      ) : (
        <CardLayout {...props} />
      )}
    </Box>
  );
}

function ctxFor(props: ViewProps, view: PositionView): RowContext {
  return {
    view,
    faulted: props.faulted,
    trend: props.trendFor(view.position.id),
    sessionDelta: props.sessionDeltaFor?.(view.position.id) ?? null,
    streamOffline: props.streamOffline,
    onClose: props.onClose,
    onCancel: props.onCancel,
    onViewOrder: props.onViewOrder,
  };
}

/** The mono group subtotal, success/error by sign (the static derived sum). */
function subtotalNode(group: DerivedGroup) {
  const excl =
    group.excludedCount > 0
      ? ` · ${group.excludedCount} position${group.excludedCount > 1 ? 's' : ''} excluded (unavailable)`
      : '';
  return (
    <Typography
      component="span"
      data-testid="subtotal"
      sx={{ fontSize: '0.78rem', color: 'text.secondary', fontWeight: 400 }}
    >
      Subtotal{' '}
      <Box
        component="span"
        sx={{
          fontWeight: 600,
          color: group.subtotal >= 0 ? upText : downText,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {money(group.subtotal)}
      </Box>
      {excl}
    </Typography>
  );
}

// ---- Table layout ------------------------------------------------------------------------------

/** The board's `.ap-table th` (fidelity ACC-09): 11px caps at 0.06em over the strong hairline. */
const thSx = {
  textAlign: 'left' as const,
  padding: '10px 12px',
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  color: 'text.secondary',
  borderBottom: '1px solid',
  borderColor: (t: Theme) => extrasFor(t).lineStrong,
  whiteSpace: 'nowrap' as const,
};

/**
 * The book's frame: the panel (radius 12, the panel role; fidelity ACC-24). On the demo it is a
 * sample frame (canon P-3, P-8): dashed, the 8px hatch band at its head, and its one "Sample" in a
 * head row, the source chip (owner D1; the board's `.ap-tbl.is-sample` and `.ac-tblhead`).
 */
export const bookFrameSx = (sample: boolean) => (t: Theme) => ({
  position: 'relative' as const,
  bgcolor: 'background.paper',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1,
  overflow: 'hidden',
  ...(sample && {
    borderStyle: 'dashed',
    borderColor: extrasFor(t).textTertiary,
    '&::before': {
      content: '""',
      position: 'absolute' as const,
      left: 0,
      right: 0,
      top: 0,
      height: 8,
      borderRadius: '11px 11px 0 0',
      pointerEvents: 'none' as const,
      zIndex: 3,
      background: `repeating-linear-gradient(135deg, transparent 0 6px, ${alpha(
        t.palette.text.secondary,
        0.28,
      )} 6px 12px)`,
    },
  }),
});

/** The sample frame's head row: the source chip and where the marks come from. */
function SampleMarksHead({ framed }: { framed: boolean }) {
  return (
    <Box
      data-testid="positions-sample-head"
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px 12px',
        ...(framed
          ? { p: '12px 14px', borderBottom: '1px solid', borderColor: 'divider' }
          : { mb: '12px' }),
      }}
    >
      <SampleMarksChip />
      <Typography component="span" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
        {sampleMarksLine()}
      </Typography>
    </Box>
  );
}

function TableLayout(props: ViewProps & { visibleColumns: ColumnKey[] }) {
  const { density } = props;
  const sample = useMarkFeed() === 'sample';
  // REVISION 2 — the fixed Figma set (not `props.columns`), narrowed by the ONE breakpoint gate.
  const columns = props.visibleColumns;
  const isGrouped = props.groups.length > 1 || props.groups[0]?.key !== '__all__';
  // The board's row: 10px 12px, so a two-line contract cell makes a 60px row (fidelity ACC-09).
  const tdPad = density === 'compact' ? '7px 12px' : '10px 12px';
  return (
    <Box
      data-testid="positions-table-frame"
      data-provenance={sample ? 'sample' : 'primary'}
      sx={bookFrameSx(sample)}
    >
      {sample && <SampleMarksHead framed />}
      <Box sx={{ overflowX: 'auto', overflowY: 'hidden' }}>
        <Box
          component="table"
          data-testid="positions-table"
          data-density={density}
          sx={{ width: '100%', borderCollapse: 'collapse' }}
        >
          <Box component="thead">
            <Box component="tr">
              {columns.map((c) => (
                <Box
                  component="th"
                  key={c}
                  sx={NUMERIC_COLUMNS.has(c) ? { ...thSx, textAlign: 'right' } : thSx}
                >
                  {headerLabel(c)}
                </Box>
              ))}
              <Box
                component="th"
                sx={{
                  ...thSx,
                  position: 'sticky',
                  right: 0,
                  zIndex: 2,
                  bgcolor: 'background.paper',
                  borderLeft: '1px solid',
                  borderLeftColor: 'divider',
                }}
              />
            </Box>
          </Box>
          <Box component="tbody">
            {props.groups.map((g) => (
              <GroupRows
                key={g.key}
                group={g}
                props={props}
                columns={columns}
                showHeader={isGrouped}
                tdPad={tdPad}
              />
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function GroupRows({
  group,
  props,
  columns,
  showHeader,
  tdPad,
}: {
  group: DerivedGroup;
  props: ViewProps;
  columns: ColumnKey[];
  showHeader: boolean;
  tdPad: string;
}) {
  return (
    <>
      {showHeader && (
        <Box component="tr" data-testid="group-header" data-group={group.key}>
          <Box
            component="td"
            colSpan={columns.length + 1}
            sx={{
              bgcolor: (theme) => extrasFor(theme).panelRaised,
              padding: '8px 12px',
              fontSize: '0.78rem',
              fontWeight: 600,
            }}
          >
            <Box component="span" sx={{ opacity: props.streamOffline ? 0.85 : 1 }}>
              {group.label} ({group.views.length}){'  '}
            </Box>
            {subtotalNode(group)}
            {props.streamOffline && (
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  color: 'text.disabled',
                  ml: '6px',
                  verticalAlign: 'middle',
                }}
              >
                <PauseMark />
              </Box>
            )}
          </Box>
        </Box>
      )}
      {group.views.map((view) => (
        <PositionRow
          key={view.position.id}
          ctx={ctxFor(props, view)}
          columns={columns}
          tdPad={tdPad}
          onClose={props.onClose}
        />
      ))}
    </>
  );
}

// ---- Cards layout ------------------------------------------------------------------------------

function CardLayout(props: ViewProps) {
  const { density } = props;
  const sample = useMarkFeed() === 'sample';
  const isGrouped = props.groups.length > 1 || props.groups[0]?.key !== '__all__';
  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: isGrouped ? '18px' : '12px' }}
      data-testid="positions-cards"
      data-density={density}
    >
      {/* The cards name the sample once, above them, as the table's frame does in its head. */}
      {sample && <SampleMarksHead framed={false} />}
      {props.groups.map((g) => (
        <Box key={g.key}>
          {isGrouped && (
            <Box
              sx={{ mb: '8px', fontSize: '0.82rem', fontWeight: 600 }}
              data-testid="group-header"
              data-group={g.key}
            >
              {g.label} ({g.views.length}) · {subtotalNode(g)}
            </Box>
          )}
          {/* 1 column below `sm` (a 2-up card at 393px crushes the footer facts row and can force
              horizontal overflow — Stage 0 item 1); the Figma 2-col grid holds at sm+. */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
              gap: '12px',
            }}
          >
            {g.views.map((view) => (
              <PositionCard
                key={view.position.id}
                view={view}
                ctx={ctxFor(props, view)}
                streamOffline={props.streamOffline}
                onClose={props.onClose}
              />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

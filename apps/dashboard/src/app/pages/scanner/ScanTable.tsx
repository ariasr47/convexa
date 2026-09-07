/**
 * `/scanner` — the ≥`sm` dense terminal table (UX §1.1/§1.2): the LOCKED 11-column set in its locked
 * order, a sticky header row, a sticky Symbol column, and `compact` density by default. The table
 * scrolls inside its OWN `overflow-x` container so a wide desktop column set can never make the page
 * body scroll sideways.
 *
 * A row is a NAVIGATION target and nothing else (`[no-real-order-path]`, AC-11): the Symbol cell
 * carries a real `<a href="/ticker/{SYMBOL}">` (keyboard-reachable, gets the global `:focus-visible`
 * ring) and the row body forwards a click to the same route. There is no order, trade, or broker
 * affordance anywhere on this surface.
 */
import { MONO_FACE } from '@/shared/figure';
import { extrasFor } from '@/shared/theme/tokens';
import type { ScanDensity, ScanRow, ScanViewSort } from '@convexa/api';
import Box from '@mui/material/Box';
import { Fragment } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import type { PollDelta } from './format';
import {
  COLUMN_LABELS,
  regimeLookup,
  SCAN_COLUMNS,
  SCAN_COPY,
  SORTABLE_COLUMNS,
  volLookup,
  type ScanColumn,
} from './labels';
import {
  ChgCell,
  LabelCell,
  LevelDistCell,
  PriceCell,
  ScoreCell,
  StatusCell,
  TierCell,
  UpdatedCell,
} from './ScanCells';

/** index-first-defaults AC-3 — one table section. `label: null` renders no header row (the
 *  remaining-universe tail); a labelled group gets the table's own header treatment. */
export interface ScanGroup {
  key: string;
  label: string | null;
  rows: ScanRow[];
}

export interface ScanTableProps {
  rows: ScanRow[];
  sort: ScanViewSort;
  density: ScanDensity;
  nowS: number;
  /** Gate for the sanctioned price flash — off while the sweep is down (nothing is changing). */
  flashActive: boolean;
  onSort: (sort: ScanViewSort) => void;
  /** Zero-state grouping (index-first-defaults AC-3). Absent ⇒ the flat `rows` render exactly as
   *  today — a SAVED view is never regrouped. When present, `rows` must equal the concatenation. */
  groups?: ScanGroup[];
  /** Poll-to-poll structure deltas by symbol. */
  deltas?: Map<string, PollDelta>;
  /** SPEC §2.2 — `{ retained: boolean } | null` per symbol, computed once at `Scanner.tsx`. The
   *  outer null/non-null is the stream's own state; the inner boolean is the datum's provenance.
   *  Price ONLY — no structure figure ever takes this prop (criterion 10). */
  priceOffline: (symbol: string) => { retained: boolean } | null;
}

const thSx = {
  position: 'sticky' as const,
  top: 0,
  zIndex: 2,
  textAlign: 'left' as const,
  padding: '9px 10px',
  fontSize: '0.6875rem', // the 11px chip/label type floor
  fontWeight: 600,
  letterSpacing: '.03em',
  textTransform: 'uppercase' as const,
  color: 'text.secondary',
  bgcolor: 'background.paper',
  borderBottom: '1px solid',
  borderColor: 'divider',
  whiteSpace: 'nowrap' as const,
};
/** The sticky Symbol column keeps identity on screen while the numerics scroll under it. */
const stickyColSx = { position: 'sticky' as const, left: 0, bgcolor: 'background.paper' };

/** Sort header control — keyboard-reachable button with a real hit area (spine #6).
 *  Global `:focus-visible` ring applies; coarse pointers get the theme ≥44px floor. */
const sortButtonSx = {
  background: 'none',
  border: 'none',
  font: 'inherit',
  color: 'inherit',
  letterSpacing: 'inherit',
  textTransform: 'inherit' as const,
  cursor: 'pointer',
  // Comfortable keyboard / pointer target without blowing dense header chrome.
  minHeight: 32,
  minWidth: 44,
  px: 0.75,
  py: 0.5,
  mx: -0.75,
  borderRadius: '4px',
  textAlign: 'left' as const,
};

function ariaSortOf(column: ScanColumn, sort: ScanViewSort): 'ascending' | 'descending' | 'none' {
  const key = SORTABLE_COLUMNS[column];
  if (!key || key !== sort.key) return 'none';
  return sort.dir === 'asc' ? 'ascending' : 'descending';
}

function HeaderCell({
  column,
  sort,
  onSort,
}: {
  column: ScanColumn;
  sort: ScanViewSort;
  onSort: (sort: ScanViewSort) => void;
}) {
  const key = SORTABLE_COLUMNS[column];
  const label = COLUMN_LABELS[column];
  const active = key != null && key === sort.key;
  const arrow = active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '';
  return (
    <Box
      component="th"
      scope="col"
      aria-sort={ariaSortOf(column, sort)}
      data-testid={`scan-th-${column}`}
      sx={column === 'symbol' ? { ...thSx, ...stickyColSx, zIndex: 3 } : thSx}
    >
      {key ? (
        <Box
          component="button"
          type="button"
          data-testid={`scan-sort-${column}`}
          aria-label={SCAN_COPY.sortAria(label)}
          onClick={() => onSort({ key, dir: active && sort.dir === 'desc' ? 'asc' : 'desc' })}
          sx={sortButtonSx}
        >
          {label}
          {arrow}
        </Box>
      ) : (
        label
      )}
    </Box>
  );
}

function cellContent(
  column: ScanColumn,
  row: ScanRow,
  nowS: number,
  flashActive: boolean,
  priceOffline: (symbol: string) => { retained: boolean } | null,
  delta?: PollDelta | null,
) {
  switch (column) {
    case 'symbol':
      return (
        <Box
          component={RouterLink}
          to={`/ticker/${row.symbol}`}
          data-testid="scan-row-link"
          // Spine #6: fill the cell so the real <a> is the keyboard + touch target (≥44 on coarse
          // via theme floor). Row body click remains mouse convenience only.
          sx={{
            ...MONO_FACE,
            fontWeight: 600,
            color: 'text.primary',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            minHeight: 32,
            // Stretch hit area without changing dense desktop type.
            py: 0.25,
            borderRadius: '4px',
            '@media (pointer: coarse)': { minHeight: 44 },
          }}
        >
          {row.symbol}
        </Box>
      );
    case 'price':
      return <PriceCell row={row} active={flashActive} offline={priceOffline(row.symbol)} />;
    case 'chg_pct':
      return <ChgCell row={row} />;
    case 'score':
      return <ScoreCell row={row} delta={delta} />;
    case 'tier':
      return <TierCell row={row} />;
    case 'regime':
      return <LabelCell testid="cell-regime" result={regimeLookup(row.regime)} />;
    case 'vol_regime':
      return <LabelCell testid="cell-vol" result={volLookup(row.vol_regime)} />;
    case 'flip':
      return (
        <LevelDistCell
          level={row.flip}
          distPct={row.dist_to_flip_pct}
          testid="cell-dist-flip"
          distDelta={delta?.flipDistDelta}
        />
      );
    case 'walls':
      return (
        <LevelDistCell
          level={
            row.dist_to_wall_pct != null && row.dist_to_wall_pct >= 0 ? row.call_wall : row.put_wall
          }
          distPct={row.dist_to_wall_pct}
          testid="cell-dist-wall"
        />
      );
    case 'updated':
      return <UpdatedCell row={row} nowS={nowS} />;
    case 'status':
      return <StatusCell row={row} nowS={nowS} />;
    default:
      return null;
  }
}

function ScanTableRow({
  row,
  density,
  nowS,
  flashActive,
  onOpen,
  delta,
  priceOffline,
}: {
  row: ScanRow;
  density: ScanDensity;
  nowS: number;
  flashActive: boolean;
  onOpen: (symbol: string) => void;
  delta?: PollDelta | null;
  priceOffline: (symbol: string) => { retained: boolean } | null;
}) {
  const tdSx = {
    padding: density === 'compact' ? '7px 10px' : '12px 10px',
    fontSize: density === 'compact' ? '0.8rem' : '0.86rem',
    borderBottom: '1px solid',
    borderColor: 'divider',
    whiteSpace: 'nowrap' as const,
    // Coarse-pointer tap-target floor (≥44px row) without inflating the dense desktop read.
    '@media (pointer: coarse)': { paddingTop: '12px', paddingBottom: '12px' },
  };
  return (
    <Box
      component="tr"
      data-testid="scan-row"
      data-symbol={row.symbol}
      data-status={row.status}
      onClick={() => onOpen(row.symbol)}
      sx={{
        cursor: 'pointer',
        // Hover chrome is NEUTRAL — the row's one amber is the tier chip.
        '&:hover': { bgcolor: (theme) => extrasFor(theme).panelRaised },
      }}
    >
      {SCAN_COLUMNS.map((column) => (
        <Box
          component="td"
          key={column}
          sx={column === 'symbol' ? { ...tdSx, ...stickyColSx } : tdSx}
        >
          {cellContent(column, row, nowS, flashActive, priceOffline, delta)}
        </Box>
      ))}
    </Box>
  );
}

export function ScanTable({
  rows,
  sort,
  density,
  nowS,
  flashActive,
  onSort,
  groups,
  deltas,
  priceOffline,
}: ScanTableProps) {
  const navigate = useNavigate();
  // Ungrouped ⇒ ONE unlabeled section: the body renders identically to the pre-grouping table.
  const sections: ScanGroup[] = groups ?? [{ key: 'all', label: null, rows }];
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        // U-35 (scanner half): the panel role is 12 (`shape.borderRadius`), not a raw '10px' string.
        borderRadius: 1,
        // The WIDE content scrolls inside its own container — the page body never scrolls sideways.
        overflowX: 'auto',
        maxHeight: '70vh',
        overflowY: 'auto',
      }}
    >
      <Box
        component="table"
        data-testid="scan-table"
        data-density={density}
        sx={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}
      >
        <Box component="thead">
          <Box component="tr">
            {SCAN_COLUMNS.map((column) => (
              <HeaderCell key={column} column={column} sort={sort} onSort={onSort} />
            ))}
          </Box>
        </Box>
        <Box component="tbody">
          {sections.map((group) => (
            <Fragment key={group.key}>
              {group.label != null && (
                /* AC-3: the lead-group header REUSES the table's header treatment (same type ramp,
                   same secondary token) — no new visual language, no color semantics. Non-sticky:
                   it scrolls with its rows. */
                <Box component="tr" data-testid="scan-group-header">
                  <Box
                    component="th"
                    scope="colgroup"
                    colSpan={SCAN_COLUMNS.length}
                    sx={{ ...thSx, position: 'static', zIndex: 'auto' }}
                  >
                    {group.label}
                  </Box>
                </Box>
              )}
              {group.rows.map((row) => (
                <ScanTableRow
                  key={row.symbol}
                  row={row}
                  density={density}
                  nowS={nowS}
                  flashActive={flashActive}
                  delta={deltas?.get(row.symbol)}
                  onOpen={(symbol) => navigate(`/ticker/${symbol}`)}
                  priceOffline={priceOffline}
                />
              ))}
            </Fragment>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

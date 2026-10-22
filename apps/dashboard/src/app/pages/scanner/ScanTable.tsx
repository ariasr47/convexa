/**
 * `/scanner` — the ≥`sm` dense terminal table (UX §1.1/§1.2): the LOCKED 11-column set in its locked
 * order, a sticky header row, a sticky Symbol column, and `compact` density by default. The table
 * scrolls inside its OWN `overflow-x` container so a wide desktop column set can never make the page
 * body scroll sideways.
 *
 * A row READS and NAVIGATES, nothing else (`[no-real-order-path]`, AC-11): the Symbol cell carries a
 * real `<a href="/ticker/{SYMBOL}">` (keyboard-reachable, gets the global `:focus-visible` ring), and
 * the row opens its preview (Final Scanner board, site check D-03): the chevron button at its right
 * edge, Enter on the focused row, or a click on the row body. The preview reads back the row's own
 * fields and links the same desk; Escape closes it and returns focus to the control that opened it.
 * One preview is open at a time. There is no order, trade, or broker affordance anywhere on this
 * surface.
 */
import { visuallyHidden } from '@/shared/a11y/visuallyHidden';
import { MONO_FACE } from '@/shared/figure';
import { extrasFor } from '@/shared/theme/tokens';
import type { ScanDensity, ScanRow, ScanViewSort } from '@convexa/api';
import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import { Fragment, useCallback, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { type PollDelta } from './format';
import {
  COLUMN_LABELS,
  regimeLookup,
  SCAN_COLUMNS,
  SCAN_COPY,
  SCAN_PREVIEW_COPY,
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
  WallsCell,
} from './ScanCells';
import { PreviewToggle, ScanRowPreview } from './ScanRowPreview';

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
  /** Present only for sample data (the demo): the sample frame's head (SampleAwareFrame). */
  sampleHead?: ReactNode;
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
      return <WallsCell row={row} />;
    case 'updated':
      return <UpdatedCell row={row} nowS={nowS} />;
    case 'status':
      return <StatusCell row={row} nowS={nowS} />;
    default:
      return null;
  }
}

/** How the open preview was opened: Escape returns focus to that control. */
type PreviewOpener = 'row' | 'button';

/** The table's columns plus the preview chevron's own trailing column. */
const COLUMN_COUNT = SCAN_COLUMNS.length + 1;

function ScanTableRow({
  row,
  density,
  nowS,
  flashActive,
  delta,
  priceOffline,
  previewOpen,
  onPreview,
  onPreviewEscape,
  rowRef,
  buttonRef,
}: {
  row: ScanRow;
  density: ScanDensity;
  nowS: number;
  flashActive: boolean;
  delta?: PollDelta | null;
  priceOffline: (symbol: string) => { retained: boolean } | null;
  previewOpen: boolean;
  onPreview: (symbol: string, via: PreviewOpener) => void;
  onPreviewEscape: (symbol: string) => void;
  rowRef: (el: HTMLElement | null) => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
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
  // Escape anywhere in the row or its preview closes the preview and hands focus back.
  const escape = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Escape' || !previewOpen) return;
    e.preventDefault();
    e.stopPropagation();
    onPreviewEscape(row.symbol);
  };
  return (
    <>
      <Box
        component="tr"
        ref={rowRef}
        tabIndex={0}
        // No aria-expanded here: on a plain table row ARIA allows it only inside a treegrid (axe
        // aria-conditional-attr, serious). The chevron button carries the expanded state and
        // aria-controls; Enter on the row is a keyboard shortcut to the same toggle.
        data-testid="scan-row"
        data-symbol={row.symbol}
        data-status={row.status}
        onClick={(e) => {
          // The symbol link navigates, and the chevron and the score's help handle themselves.
          if ((e.target as HTMLElement).closest('a, button')) return;
          onPreview(row.symbol, 'row');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') return escape(e);
          // Only the row itself: Enter on the symbol link still opens the desk.
          if (e.key !== 'Enter' || e.target !== e.currentTarget) return;
          e.preventDefault();
          onPreview(row.symbol, 'row');
        }}
        sx={{
          cursor: 'pointer',
          // Hover chrome is NEUTRAL — the row's one amber is the tier chip.
          '&:hover': { bgcolor: (theme) => extrasFor(theme).panelRaised },
          // The theme's one focus ring (its colour and width), drawn on the cells' inner edges: an
          // outline on a <tr> is clipped by the table's own scroller and painted over by the sticky
          // Symbol cell.
          '&:focus-visible': { outline: 'none' },
          '&:focus-visible > td': (theme) => {
            const ring = extrasFor(theme).textAmber;
            return { boxShadow: `inset 0 2px 0 ${ring}, inset 0 -2px 0 ${ring}` };
          },
          '&:focus-visible > td:first-of-type': (theme) => {
            const ring = extrasFor(theme).textAmber;
            return {
              boxShadow: `inset 2px 0 0 ${ring}, inset 0 2px 0 ${ring}, inset 0 -2px 0 ${ring}`,
            };
          },
          '&:focus-visible > td:last-of-type': (theme) => {
            const ring = extrasFor(theme).textAmber;
            return {
              boxShadow: `inset -2px 0 0 ${ring}, inset 0 2px 0 ${ring}, inset 0 -2px 0 ${ring}`,
            };
          },
          ...(previewOpen && { '& > td': { borderBottomColor: 'transparent' } }),
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
        <Box component="td" sx={{ ...tdSx, py: 0, px: '6px', textAlign: 'right' }}>
          <PreviewToggle
            symbol={row.symbol}
            open={previewOpen}
            onToggle={() => onPreview(row.symbol, 'button')}
            buttonRef={buttonRef}
          />
        </Box>
      </Box>
      <ScanRowPreview row={row} open={previewOpen} colSpan={COLUMN_COUNT} onKeyDown={escape} />
    </>
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
  sampleHead,
}: ScanTableProps) {
  // Ungrouped ⇒ ONE unlabeled section: the body renders identically to the pre-grouping table.
  const sections: ScanGroup[] = groups ?? [{ key: 'all', label: null, rows }];

  // One preview open at a time; ephemeral (never persisted, gone on reload), like the leg
  // disclosure on Positions. Keyed by symbol, so a poll that re-sorts the rows keeps it open.
  const [preview, setPreview] = useState<{ symbol: string; via: PreviewOpener } | null>(null);
  const rowEls = useRef(new Map<string, HTMLElement>());
  const buttonEls = useRef(new Map<string, HTMLButtonElement>());
  const onPreview = useCallback((symbol: string, via: PreviewOpener) => {
    setPreview((cur) => (cur?.symbol === symbol ? null : { symbol, via }));
  }, []);
  const onPreviewEscape = useCallback(
    (symbol: string) => {
      const via = preview?.symbol === symbol ? preview.via : 'row';
      setPreview(null);
      (via === 'button' ? buttonEls.current.get(symbol) : rowEls.current.get(symbol))?.focus();
    },
    [preview],
  );
  const track =
    <T extends HTMLElement>(map: Map<string, T>, symbol: string) =>
    (el: T | null) => {
      if (el) map.set(symbol, el);
      else map.delete(symbol);
    };

  return (
    <SampleAwareFrame sampleHead={sampleHead}>
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
            <Box
              component="th"
              scope="col"
              data-testid="scan-th-preview"
              sx={{ ...thSx, width: 44 }}
            >
              <Box component="span" sx={visuallyHidden}>
                {SCAN_PREVIEW_COPY.columnLabel}
              </Box>
            </Box>
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
                    colSpan={COLUMN_COUNT}
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
                  priceOffline={priceOffline}
                  previewOpen={preview?.symbol === row.symbol}
                  onPreview={onPreview}
                  onPreviewEscape={onPreviewEscape}
                  rowRef={track(rowEls.current, row.symbol)}
                  buttonRef={track(buttonEls.current, row.symbol)}
                />
              ))}
            </Fragment>
          ))}
        </Box>
      </Box>
    </SampleAwareFrame>
  );
}

/**
 * The table's panel. Sample data takes the sample frame (canon P-8, as ChartFrame draws it): a dashed
 * border with the hatch stripe and the sample head above the rows, so a demo scan never reads as
 * market data (site check D-03). Otherwise the solid panel, as before.
 */
export function SampleAwareFrame({
  sampleHead,
  children,
}: {
  sampleHead?: ReactNode;
  children: ReactNode;
}) {
  const sample = sampleHead != null;
  return (
    <Box
      data-provenance={sample ? 'sample' : undefined}
      sx={(t) => ({
        position: 'relative',
        bgcolor: 'background.paper',
        border: sample ? `1px dashed ${extrasFor(t).textTertiary}` : '1px solid',
        borderColor: sample ? undefined : 'divider',
        // U-35 (scanner half): the panel role is 12 (`shape.borderRadius`), not a raw '10px' string.
        borderRadius: 1,
        overflow: 'hidden',
        ...(sample && {
          pt: '8px',
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 8,
            pointerEvents: 'none',
            background: `repeating-linear-gradient(135deg, transparent 0 6px, ${alpha(
              t.palette.text.secondary,
              0.28,
            )} 6px 12px)`,
          },
        }),
      })}
    >
      {sample && (
        <Box
          data-testid="scan-sample-head"
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '6px 10px',
            px: '12px',
            py: '10px',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          {sampleHead}
        </Box>
      )}
      {/* The WIDE content scrolls inside its own container — the page body never scrolls sideways
          (criterion 21, the only scroll behaviour that criterion pins). No vertical cap: the
          design/src/screens/scanner.mjs table scrolls with the PAGE, not in a second internal
          scroller (F8) — `maxHeight: '70vh'` / `overflowY: 'auto'` are gone. */}
      <Box sx={{ overflowX: 'auto' }}>{children}</Box>
    </Box>
  );
}

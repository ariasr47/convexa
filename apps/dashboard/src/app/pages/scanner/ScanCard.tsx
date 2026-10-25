/**
 * `/scanner` — the `<sm` card collapse (UX §1.3): one card per symbol, ONE column at phone width, no
 * horizontal overflow at 390px, nothing clipped.
 *
 * Three lines, as the Final Scanner phone board draws them (`design/src/screens/final/
 * account-pages.mjs` demoScanTable `.ap-cards`; fidelity ACC-05): symbol | price ▼chg; score bar ·
 * score · tier · regime; Flip distance · walls. A footer appears only when the row's state says
 * something (a status other than `ok`, and a stale row's age). The card was 2.6× the board's area
 * with a fact grid and a footer on every row.
 *
 * The whole card IS the navigation target: it renders as a single block-level `<a>` to
 * `/ticker/{SYMBOL}` (≥44px, keyboard-reachable, global `:focus-visible` ring) and performs no other
 * action (`[no-real-order-path]`, AC-11). It reuses the SAME `ScanCells` atoms as the table, so a
 * datum can never be rendered two ways.
 */
import { visuallyHidden } from '@/shared/a11y/visuallyHidden';
import { MONO_FACE } from '@/shared/figure';
import type { ScanRow } from '@convexa/api';
import Box from '@mui/material/Box';
import { useId, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { type PollDelta } from './format';
import { regimeLookup, statusMeta, whyThisRow } from './labels';
import {
  ChgCell,
  DistFigure,
  LabelCell,
  PriceCell,
  RowFlags,
  ScoreCell,
  TierCell,
  WallLevels,
} from './ScanCells';
import { sampleFrameSx, sampleHeadRowSx } from './ScanTable';

export interface ScanCardProps {
  row: ScanRow;
  nowS: number;
  flashActive: boolean;
  delta?: PollDelta | null;
  /** SPEC §2.2 — `{ retained: boolean } | null` per symbol, computed once at `Scanner.tsx`. Price
   *  ONLY — no structure figure ever takes this prop (criterion 10). */
  priceOffline: (symbol: string) => { retained: boolean } | null;
  /** Sample data (the demo): the card takes the sample frame's dashed border and hatch band. */
  sample?: boolean;
}

export function ScanCard({
  row,
  nowS,
  flashActive,
  delta,
  priceOffline,
  sample = false,
}: ScanCardProps) {
  const scoreDescriptionId = useId();
  const flagged = statusMeta(row.status).label != null;
  return (
    <Box
      component={RouterLink}
      to={`/ticker/${row.symbol}`}
      aria-describedby={scoreDescriptionId}
      tabIndex={0}
      data-testid="scan-card"
      data-symbol={row.symbol}
      data-status={row.status}
      data-provenance={sample ? 'sample' : undefined}
      sx={(t) => ({
        ...(sample
          ? sampleFrameSx(t)
          : {
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              // U-35 (scanner half): the panel role is 12 (`shape.borderRadius`).
              borderRadius: 1,
            }),
        // The board's `.hd-p` card: 16px in, 8px between lines.
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minHeight: 44,
        padding: '16px',
        textDecoration: 'none',
        color: 'inherit',
      })}
    >
      {/* 1 · Symbol | price (flash) · chg % (the one direction colour). */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <Box
          component="span"
          sx={{ ...MONO_FACE, fontWeight: 600, fontSize: '1rem', lineHeight: 1.5 }}
        >
          {row.symbol}
        </Box>
        <Box
          component="span"
          sx={{
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: '12px',
            fontSize: '0.875rem',
            minWidth: 0,
          }}
        >
          <PriceCell row={row} active={flashActive} offline={priceOffline(row.symbol)} />
          <ChgCell row={row} />
        </Box>
      </Box>

      {/* 2 · Score bar · score · tier · regime — the triage read, all neutral. */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '4px 16px',
          fontSize: '0.8125rem',
          // The board's 19.5px line (13px × 1.5), not the body's 1.65 (the atoms are Typography,
          // whose variant sets its own line height, so the rule reaches them by class).
          lineHeight: 1.5,
          '& .MuiTypography-root': { lineHeight: 1.5 },
        }}
      >
        <Box component="span" sx={{ display: 'inline-flex' }}>
          <ScoreCell row={row} delta={delta} focusableHelp={false} />
          <Box component="span" id={scoreDescriptionId} sx={visuallyHidden}>
            {whyThisRow(row)}
          </Box>
        </Box>
        <TierCell row={row} />
        <LabelCell testid="cell-regime" result={regimeLookup(row.regime)} />
      </Box>

      {/* 3 · Flip distance · call / put walls, one quiet line. */}
      <Box component="span" sx={{ fontSize: '0.75rem', lineHeight: 1.45, color: 'text.secondary' }}>
        Flip <DistFigure distPct={row.dist_to_flip_pct} testid="cell-dist-flip" size="inherit" />
        {' · walls '}
        <WallLevels row={row} color="text.secondary" />
      </Box>

      {/* Footer only when the row's state says something (status ≠ ok; a stale row's age). */}
      {flagged && (
        <Box sx={{ pt: '8px', borderTop: '1px solid', borderColor: 'divider' }}>
          <RowFlags row={row} nowS={nowS} />
        </Box>
      )}
    </Box>
  );
}

/**
 * One column at phone width — a 2-up card at 393px crushes the card (the Stage-0 lesson). On sample
 * data the sample head stands in its own dashed box above the cards, and each card is dashed: the
 * cards are not nested inside a frame (the Final phone board; fidelity ACC-05).
 */
export function ScanCardList({
  rows,
  nowS,
  flashActive,
  deltas,
  priceOffline,
  sampleHead,
}: {
  rows: ScanRow[];
  deltas?: Map<string, PollDelta>;
  /** Present only for sample data (the demo): the sample head's words. */
  sampleHead?: ReactNode;
} & Omit<ScanCardProps, 'row' | 'delta' | 'sample'>) {
  const sample = sampleHead != null;
  return (
    <Box
      data-testid="scan-cards"
      sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '12px' }}
    >
      {sample && (
        <Box
          data-testid="scan-sample-head"
          data-provenance="sample"
          sx={(t) => ({ ...sampleFrameSx(t), ...sampleHeadRowSx, padding: '12px 14px' })}
        >
          {sampleHead}
        </Box>
      )}
      {rows.map((row) => (
        <ScanCard
          key={row.symbol}
          row={row}
          nowS={nowS}
          flashActive={flashActive}
          delta={deltas?.get(row.symbol)}
          priceOffline={priceOffline}
          sample={sample}
        />
      ))}
    </Box>
  );
}

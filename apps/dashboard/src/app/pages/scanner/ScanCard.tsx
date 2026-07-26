/**
 * `/scanner` — the `<sm` card collapse (UX §1.3), mirroring the Positions `PositionCard` shape: one
 * card per symbol, ONE column at phone width, no horizontal overflow at 393px, nothing clipped.
 *
 * The whole card IS the navigation target: it renders as a single block-level `<a>` to
 * `/ticker/{SYMBOL}` (≥44px, keyboard-reachable, global `:focus-visible` ring) and performs no other
 * action (`[no-real-order-path]`, AC-11). It reuses the SAME `ScanCells` atoms as the table, so a
 * datum can never be rendered two ways.
 */
import { Box } from '@mui/material';
import type { ScanRow } from '@org/api';
import { Link as RouterLink } from 'react-router-dom';
import {
  ChgCell,
  LabelCell,
  LevelDistCell,
  MONO,
  PriceCell,
  regimeTextOf,
  ScoreCell,
  StatusCell,
  TierCell,
  UpdatedCell,
  volTextOf,
} from './ScanCells';

export interface ScanCardProps {
  row: ScanRow;
  nowS: number;
  flashActive: boolean;
}

const factSx = { display: 'flex', flexDirection: 'column' as const, gap: '2px', minWidth: 0 };
const factLabelSx = { fontSize: '0.6875rem', color: 'text.secondary' };

export function ScanCard({ row, nowS, flashActive }: ScanCardProps) {
  return (
    <Box
      component={RouterLink}
      to={`/ticker/${row.symbol}`}
      data-testid="scan-card"
      data-symbol={row.symbol}
      data-status={row.status}
      sx={{
        display: 'block',
        minHeight: 44,
        textDecoration: 'none',
        color: 'inherit',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '10px',
        padding: '13px',
      }}
    >
      {/* Header: Symbol · Tier (the amber) · Status (only when not `ok`). */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          mb: '10px',
        }}
      >
        <Box component="span" sx={{ ...MONO, fontWeight: 700, fontSize: '1rem' }}>
          {row.symbol}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <TierCell row={row} />
          <StatusCell row={row} nowS={nowS} />
        </Box>
      </Box>

      {/* Primary line: price (flash) · chg % (the one direction colour). */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '10px', fontSize: '1.1rem' }}>
        <PriceCell row={row} active={flashActive} />
        <Box component="span" sx={{ fontSize: '0.9rem' }}>
          <ChgCell row={row} />
        </Box>
      </Box>

      {/* Score gets its own labelled line — it is the triage headline. */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '8px', mt: '8px' }}>
        <Box component="span" sx={factLabelSx}>
          Score
        </Box>
        <Box component="span" sx={{ fontSize: '1.05rem' }}>
          <ScoreCell row={row} />
        </Box>
      </Box>

      {/* Secondary 2-col grid — all neutral. */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '8px 12px',
          mt: '10px',
          fontSize: '0.8rem',
        }}
      >
        <Box sx={factSx}>
          <Box component="span" sx={factLabelSx}>
            Regime
          </Box>
          <LabelCell testid="cell-regime" text={regimeTextOf(row)} />
        </Box>
        <Box sx={factSx}>
          <Box component="span" sx={factLabelSx}>
            Vol
          </Box>
          <LabelCell testid="cell-vol" text={volTextOf(row)} />
        </Box>
        <Box sx={factSx}>
          <Box component="span" sx={factLabelSx}>
            Flip
          </Box>
          <LevelDistCell level={row.flip} distPct={row.dist_to_flip_pct} testid="cell-dist-flip" />
        </Box>
        <Box sx={factSx}>
          <Box component="span" sx={factLabelSx}>
            Wall
          </Box>
          <LevelDistCell
            level={
              row.dist_to_wall_pct != null && row.dist_to_wall_pct >= 0 ? row.call_wall : row.put_wall
            }
            distPct={row.dist_to_wall_pct}
            testid="cell-dist-wall"
          />
        </Box>
      </Box>

      {/* Footer: the freshness line (absent for a `building` row — the status chip says why). */}
      <Box
        sx={{
          mt: '10px',
          pt: '9px',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <UpdatedCell row={row} nowS={nowS} />
      </Box>
    </Box>
  );
}

/** One column at phone width — a 2-up card at 393px crushes the fact grid (the Stage-0 lesson). */
export function ScanCardList({
  rows,
  nowS,
  flashActive,
}: { rows: ScanRow[] } & Omit<ScanCardProps, 'row'>) {
  return (
    <Box data-testid="scan-cards" sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
      {rows.map((row) => (
        <ScanCard key={row.symbol} row={row} nowS={nowS} flashActive={flashActive} />
      ))}
    </Box>
  );
}

/**
 * `ReadStrip` — the read strip (SPEC §2.4, §2.5, §4.1, §4.6; DESIGN_SYSTEM.md rule 15). EIGHT
 * FIXED SLOTS, always, each rendered through `FigureCell` — the whole desk's honest liveness state
 * for this widget is eight dotless cells (criterion 8): every slot passes `live={NOT_LIVE}` from
 * the model, so a stray live claim here would be a compile error.
 *
 * THE CONTAINER-QUERY HAZARD (SPEC §2.5). `FigureCell.tsx` queries `theme.containerQueries('panel')`
 * against the NEAREST ancestor named `panel`. `Widget.tsx` and `PanelContainer.tsx` are the only two
 * declarations in the app. Declaring the name at THIS widget's own body (which `Widget` already
 * does) would make the ~1280px panel body the nearest named ancestor for every ~140px cell, so the
 * 20→17→15px step would never fire at any viewport. Each cell is therefore wrapped in its OWN
 * `PanelContainer` (same name, NESTED — the nearest-ancestor rule does the work), never a second
 * container name and never `containerName: 'panel'` on the rail itself.
 *
 * THE RAIL, NOT THE PAGE (criterion 50, SB). `overflowX: 'auto'` + `minWidth: 0` on the rail; the
 * page never scrolls sideways. The scrolling BEHAVIOUR itself is FE-12's browser row —
 * `[lane-check]`: jsdom cannot evaluate container queries or real scroll overflow, so this file's
 * own tests assert the DECLARATIONS only.
 *
 * PRESENTATIONAL — the caller builds the closed eight-tuple (`buildReadStrip`) and hands it down,
 * the same reason the hero's four children are presentational (SPEC §2.5). Not wired into
 * `TickerDashboard` yet (FE-11's task, matching FE-5's and FE-6's own precedent).
 */
import { PanelContainer } from '@/shared/ui/PanelContainer';
import { Widget } from '@/shared/ui/Widget';
import Box from '@mui/material/Box';
import { FigureCell } from '../_kit/FigureCell';
import type { ReadStripCells } from './readStripModel';

export interface ReadStripProps {
  /** The closed eight-tuple, already built (`buildReadStrip`) by the caller. */
  cells: ReadStripCells;
}

export function ReadStrip({ cells }: ReadStripProps) {
  return (
    <Widget
      id="read-strip"
      title="Read strip"
      subtitle="Snapshot reads off the last bundle — none of these move with the tape"
      span={2}
      bodyVariant="inset"
    >
      <Box
        data-testid="read-strip-rail"
        sx={{
          display: 'flex',
          gap: 1.5,
          overflowX: 'auto',
          minWidth: 0,
        }}
      >
        {cells.map((cell) => (
          <PanelContainer
            key={cell.slot}
            data-testid={`read-strip-cell-${cell.slot}`}
            sx={{ flex: '0 0 auto', minWidth: 140 }}
          >
            <FigureCell
              register={cell.register}
              label={cell.label}
              value={cell.value}
              live={cell.live}
              info={cell.info}
            />
          </PanelContainer>
        ))}
      </Box>
    </Widget>
  );
}

export default ReadStrip;
